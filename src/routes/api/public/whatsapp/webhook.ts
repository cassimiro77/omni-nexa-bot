import { createFileRoute } from "@tanstack/react-router";

// WhatsApp Cloud API webhook.
// GET  -> verify challenge
// POST -> receive messages: transcribe audio, handle handoff/NPS, otherwise reply via AI.
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
          type: canProcess ? "whatsapp.webhook" : "whatsapp.webhook.invalid_sig",
          payload: {
            signature_valid: sigOk,
            has_signature: Boolean(sig),
            phone_number_valid: isExpectedPhoneNumber,
            body: payload ?? { raw: raw.slice(0, 2000) },
          } as never,
        });

        if (!canProcess) return Response.json({ ok: true, ignored: "invalid_signature" });

        try {
          const entries = (payload as { entry?: unknown[] }).entry ?? [];
          for (const entry of entries) {
            const changes = ((entry as { changes?: unknown[] }).changes ?? []) as unknown[];
            for (const ch of changes) {
              const value = (ch as {
                value?: {
                  messages?: unknown[];
                  contacts?: { profile?: { name?: string }; wa_id?: string }[];
                };
              }).value;
              const messages = value?.messages ?? [];
              const waContact = value?.contacts?.[0];

              for (const msg of messages) {
                const m = msg as {
                  from?: string;
                  from_logical_id?: string;
                  id?: string;
                  type?: string;
                  text?: { body?: string };
                  audio?: { id?: string; mime_type?: string; voice?: boolean };
                  voice?: { id?: string; mime_type?: string };
                  interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } };
                };
                const from = m.from ?? waContact?.wa_id ?? m.from_logical_id;
                if (!from) continue;

                // === Extract content: text, audio (STT), or interactive ===
                let content = "";
                let audioMeta: { media_id: string; mime?: string } | null = null;

                if (m.type === "text" || m.text?.body) {
                  content = m.text?.body ?? "";
                } else if (m.type === "interactive" && m.interactive) {
                  content = m.interactive.button_reply?.title ?? m.interactive.list_reply?.title ?? "";
                } else if ((m.type === "audio" || m.type === "voice") && (m.audio?.id || m.voice?.id)) {
                  const mediaId = m.audio?.id ?? m.voice?.id ?? "";
                  const mime = m.audio?.mime_type ?? m.voice?.mime_type ?? "audio/ogg";
                  audioMeta = { media_id: mediaId, mime };
                  try {
                    const { downloadWhatsAppMedia, transcribeAudio } = await import("@/lib/whatsapp.server");
                    const dl = await downloadWhatsAppMedia(mediaId);
                    if (dl.ok && dl.data) {
                      const tr = await transcribeAudio(dl.data, dl.mime ?? mime);
                      if (tr.ok && tr.text) content = tr.text;
                    }
                  } catch (e) { console.error("stt", e); }
                  if (!content) content = "(áudio)";
                } else {
                  content = "(mensagem não suportada)";
                }

                // === Upsert contact ===
                let { data: existing } = await supabaseAdmin
                  .from("contacts").select("id, status, awaiting_nps").eq("phone", from).maybeSingle();
                const isFirstContact = !existing;
                if (!existing) {
                  const ins = await supabaseAdmin.from("contacts").insert({
                    phone: from, name: waContact?.profile?.name ?? from, origin: "whatsapp", status: "new",
                    last_message_at: new Date().toISOString(),
                  }).select("id, status, awaiting_nps").single();
                  existing = ins.data;
                } else if (waContact?.profile?.name) {
                  await supabaseAdmin.from("contacts")
                    .update({ name: waContact.profile.name, origin: "whatsapp" })
                    .eq("id", existing.id);
                }
                if (!existing) continue;

                // De-dupe by WA message id
                if (m.id) {
                  const { data: duplicate } = await supabaseAdmin.from("messages").select("id").eq("wa_message_id", m.id).maybeSingle();
                  if (duplicate) continue;
                }

                await supabaseAdmin.from("messages").insert({
                  contact_id: existing.id, direction: "inbound", channel: "whatsapp",
                  content, wa_message_id: m.id,
                  metadata: audioMeta ? { audio: audioMeta } : null,
                });
                await supabaseAdmin.from("contacts").update({ last_message_at: new Date().toISOString() }).eq("id", existing.id);

                // === NPS capture ===
                if (existing.awaiting_nps) {
                  const numMatch = content.match(/\b(10|[0-9])\b/);
                  if (numMatch) {
                    const score = parseInt(numMatch[1], 10);
                    await supabaseAdmin.from("nps_responses").insert({ contact_id: existing.id, score, comment: content });
                    await supabaseAdmin.from("contacts").update({ awaiting_nps: false }).eq("id", existing.id);
                    const thanks = score >= 9
                      ? "Muito obrigado pela nota! 🌟 Ficamos felizes em ajudar."
                      : score >= 7
                      ? "Obrigado pela avaliação! Vamos continuar melhorando. 🙏"
                      : "Obrigado pelo retorno. Vamos analisar como melhorar sua experiência. 🙏";
                    const { sendWhatsAppText } = await import("@/lib/whatsapp.server");
                    const s = await sendWhatsAppText(from, thanks);
                    await supabaseAdmin.from("messages").insert({
                      contact_id: existing.id, direction: "outbound", channel: "whatsapp",
                      content: thanks, ai_used: false, wa_message_id: s.wa_message_id ?? null,
                      metadata: { nps_thanks: true, score },
                    });
                    continue;
                  }
                  // If not a number, fall through to normal flow
                }

                // === Handoff: skip bot if human is handling ===
                if (existing.status === "human" || existing.status === "human_requested") continue;

                // === Detect handoff request ===
                const lower = content.toLowerCase();
                if (/\b(atendente|humano|falar com (uma )?pessoa|suporte humano)\b/.test(lower)) {
                  await supabaseAdmin.from("contacts").update({ status: "human_requested" }).eq("id", existing.id);
                  const notice = "Certo! Vou te transferir para um atendente. Em instantes alguém do time responde por aqui. 🙌";
                  const { sendWhatsAppText } = await import("@/lib/whatsapp.server");
                  const s = await sendWhatsAppText(from, notice);
                  await supabaseAdmin.from("messages").insert({
                    contact_id: existing.id, direction: "outbound", channel: "whatsapp",
                    content: notice, ai_used: false, wa_message_id: s.wa_message_id ?? null,
                    metadata: { handoff: true },
                  });
                  continue;
                }

                // === Welcome menu on first contact ===
                if (isFirstContact) {
                  const { data: settings } = await supabaseAdmin.from("settings").select("welcome_message, business_name").eq("id", 1).maybeSingle();
                  const biz = settings?.business_name ?? "NexaBot";
                  const welcome = settings?.welcome_message?.trim()
                    ? settings.welcome_message
                    : `Olá! 👋 Sou o assistente da ${biz}. Como posso te ajudar hoje?\n\n1️⃣ Vendas / Planos\n2️⃣ Suporte\n3️⃣ Dúvidas frequentes\n4️⃣ Falar com um atendente\n\nÉ só me dizer!`;
                  const { sendWhatsAppText } = await import("@/lib/whatsapp.server");
                  const s = await sendWhatsAppText(from, welcome);
                  await supabaseAdmin.from("messages").insert({
                    contact_id: existing.id, direction: "outbound", channel: "whatsapp",
                    content: welcome, ai_used: false, wa_message_id: s.wa_message_id ?? null,
                    metadata: { welcome: true },
                  });
                  await supabaseAdmin.from("contacts").update({ status: "in_conversation" }).eq("id", existing.id);
                  continue;
                }

                // === AI auto-reply ===
                try {
                  const { data: settings } = await supabaseAdmin.from("settings").select("ai_system_prompt, business_name, reply_with_audio").eq("id", 1).maybeSingle();
                  const apiKey = process.env.LOVABLE_API_KEY;
                  if (!apiKey) continue;

                  const { data: history } = await supabaseAdmin
                    .from("messages").select("direction, content").eq("contact_id", existing.id)
                    .order("created_at", { ascending: false }).limit(12);
                  const msgs = [
                    { role: "system", content: `${settings?.ai_system_prompt ?? "Você é um assistente comercial."} Negócio: ${settings?.business_name ?? "NexaBot"}. Responda curto e cordial, em português. Se o cliente pedir status de pedido, peça o número do pedido. Se pedir agendamento, sugira 2 horários próximos e peça confirmação.` },
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
                  if (!aiRes.ok) continue;
                  const j = (await aiRes.json()) as { choices: { message: { content: string } }[] };
                  const reply = j.choices?.[0]?.message?.content?.trim();
                  if (!reply) continue;

                  const { sendWhatsAppText, sendWhatsAppAudioLink, synthesizeAndUpload } = await import("@/lib/whatsapp.server");
                  const sendText = await sendWhatsAppText(from, reply);
                  await supabaseAdmin.from("messages").insert({
                    contact_id: existing.id, direction: "outbound", channel: "whatsapp",
                    content: reply, ai_used: true, wa_message_id: sendText.wa_message_id ?? null,
                    metadata: { auto_reply: true, delivered: sendText.ok, error: sendText.error },
                  });

                  if (settings?.reply_with_audio) {
                    try {
                      const tts = await synthesizeAndUpload(reply);
                      if (tts.ok && tts.url) {
                        const sendAudio = await sendWhatsAppAudioLink(from, tts.url);
                        await supabaseAdmin.from("messages").insert({
                          contact_id: existing.id, direction: "outbound", channel: "whatsapp",
                          content: "(áudio)", ai_used: true, wa_message_id: sendAudio.wa_message_id ?? null,
                          metadata: { auto_reply_audio: true, delivered: sendAudio.ok, error: sendAudio.error },
                        });
                      }
                    } catch (ttsErr) { console.error("tts", ttsErr); }
                  }

                  await supabaseAdmin.from("contacts").update({ last_message_at: new Date().toISOString(), status: "in_conversation" }).eq("id", existing.id);
                } catch (autoErr) { console.error("auto-reply", autoErr); }
              }
            }
          }
        } catch (e) { console.error("whatsapp parse", e); }

        return Response.json({ ok: true });
      },
    },
  },
});
