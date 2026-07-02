import { createFileRoute } from "@tanstack/react-router";

// WhatsApp Cloud API webhook.
// GET  -> verify challenge (Meta setup)
// POST -> receive messages, save inbound, generate AI reply, send back (when secrets set)
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const verifyToken = process.env.META_WA_VERIFY_TOKEN ?? "MOCK_VERIFY_TOKEN";
        if (mode === "subscribe" && token === verifyToken && challenge) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Always log the raw hit, for diagnostics. Meta's test console can omit
        // x-hub-signature-256, so unsigned payloads are accepted only when they
        // target this configured WhatsApp phone number.
        const sig = request.headers.get("x-hub-signature-256") ?? "";
        const appSecret = process.env.META_APP_SECRET;
        let sigOk = !appSecret;
        if (appSecret) {
          const { createHmac, timingSafeEqual } = await import("crypto");
          const expected = "sha256=" + createHmac("sha256", appSecret).update(raw).digest("hex");
          try {
            sigOk = sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
          } catch { sigOk = false; }
        }

        let payload: unknown = null;
        try { payload = JSON.parse(raw); } catch { /* keep raw */ }

        const expectedPhoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
        const entriesForValidation = (payload as { entry?: unknown[] } | null)?.entry ?? [];
        const isExpectedPhoneNumber = !expectedPhoneNumberId || entriesForValidation.some((entry) =>
          (((entry as { changes?: unknown[] }).changes ?? []) as unknown[]).some((ch) =>
            (ch as { value?: { metadata?: { phone_number_id?: string } } }).value?.metadata?.phone_number_id === expectedPhoneNumberId
          )
        );
        const canProcess = sigOk || (!sig && isExpectedPhoneNumber);

        await supabaseAdmin.from("events").insert({
          type: sigOk ? "whatsapp.webhook" : "whatsapp.webhook.invalid_sig",
          payload: {
            signature_valid: sigOk,
            has_signature: Boolean(sig),
            phone_number_valid: isExpectedPhoneNumber,
            body: payload ?? { raw: raw.slice(0, 2000) },
          } as never,
        });

        if (!canProcess) return Response.json({ ok: true, ignored: "invalid_signature" });


        // Best-effort: extract first message
        try {
          const entries = (payload as { entry?: unknown[] }).entry ?? [];
          for (const entry of entries) {
            const changes = ((entry as { changes?: unknown[] }).changes ?? []) as unknown[];
            for (const ch of changes) {
              const value = (ch as { value?: { messages?: unknown[]; contacts?: { profile?: { name?: string }; wa_id?: string }[] } }).value;
              const messages = value?.messages ?? [];
              const waContact = value?.contacts?.[0];
              for (const msg of messages) {
                const m = msg as { from?: string; from_logical_id?: string; text?: { body?: string }; id?: string };
                const from = m.from ?? waContact?.wa_id ?? m.from_logical_id;
                if (!from) continue;
                let { data: existing } = await supabaseAdmin.from("contacts").select("id").eq("phone", from).maybeSingle();
                if (!existing) {
                  const ins = await supabaseAdmin.from("contacts").insert({
                    phone: from, name: waContact?.profile?.name ?? from, origin: "whatsapp", status: "new",
                    last_message_at: new Date().toISOString(),
                  }).select("id").single();
                  existing = ins.data;
                }
                if (existing) {
                  if (m.id) {
                    const { data: duplicate } = await supabaseAdmin.from("messages").select("id").eq("wa_message_id", m.id).maybeSingle();
                    if (duplicate) continue;
                  }
                  await supabaseAdmin.from("messages").insert({
                    contact_id: existing.id, direction: "inbound", channel: "whatsapp",
                    content: m.text?.body ?? "(sem texto)", wa_message_id: m.id,
                  });
                  await supabaseAdmin.from("contacts").update({ last_message_at: new Date().toISOString() }).eq("id", existing.id);

                  // Auto-reply with AI (fire-and-forget, best effort)
                  try {
                    const { data: settings } = await supabaseAdmin.from("settings").select("ai_system_prompt, business_name").eq("id", 1).maybeSingle();
                    {
                      const apiKey = process.env.LOVABLE_API_KEY;
                      if (apiKey && from) {
                        const { data: history } = await supabaseAdmin
                          .from("messages").select("direction, content").eq("contact_id", existing.id)
                          .order("created_at", { ascending: false }).limit(10);
                        const msgs = [
                          { role: "system", content: `${settings?.ai_system_prompt ?? "Você é um assistente comercial."} Negócio: ${settings?.business_name ?? "NexaBot"}. Responda curto, em português.` },
                          ...[...(history ?? [])].reverse().map((h) => ({
                            role: h.direction === "inbound" ? "user" : "assistant",
                            content: h.content,
                          })),
                        ];
                        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                          body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: msgs }),
                        });
                        if (aiRes.ok) {
                          const j = await aiRes.json() as { choices: { message: { content: string } }[] };
                          const reply = j.choices?.[0]?.message?.content?.trim();
                          if (reply) {
                            const { sendWhatsAppText } = await import("@/lib/whatsapp.server");
                            const send = await sendWhatsAppText(from, reply);
                            await supabaseAdmin.from("messages").insert({
                              contact_id: existing.id, direction: "outbound", channel: "whatsapp",
                              content: reply, ai_used: true, wa_message_id: send.wa_message_id ?? null,
                              metadata: { auto_reply: true, delivered: send.ok, error: send.error },
                            });
                            await supabaseAdmin.from("contacts").update({ last_message_at: new Date().toISOString(), status: "in_conversation" }).eq("id", existing.id);
                          }
                        }
                      }
                    }
                  } catch (autoErr) { console.error("auto-reply", autoErr); }
                }
              }
            }
          }
        } catch (e) { console.error("whatsapp parse", e); }

        return Response.json({ ok: true });
      },
    },
  },
});
