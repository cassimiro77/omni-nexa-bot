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
        // Signature verification (skipped in mock mode)
        const appSecret = process.env.META_APP_SECRET;
        if (appSecret) {
          const sig = request.headers.get("x-hub-signature-256") ?? "";
          const { createHmac, timingSafeEqual } = await import("crypto");
          const expected = "sha256=" + createHmac("sha256", appSecret).update(raw).digest("hex");
          try {
            if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
              return new Response("invalid signature", { status: 401 });
            }
          } catch { return new Response("invalid signature", { status: 401 }); }
        }

        let payload: unknown;
        try { payload = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("events").insert({ type: "whatsapp.webhook", payload: payload as never });

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
                const m = msg as { from?: string; text?: { body?: string }; id?: string };
                if (!m.from) continue;
                let { data: existing } = await supabaseAdmin.from("contacts").select("id").eq("phone", m.from).maybeSingle();
                if (!existing) {
                  const ins = await supabaseAdmin.from("contacts").insert({
                    phone: m.from, name: waContact?.profile?.name ?? m.from, origin: "whatsapp", status: "new",
                    last_message_at: new Date().toISOString(),
                  }).select("id").single();
                  existing = ins.data;
                }
                if (existing) {
                  await supabaseAdmin.from("messages").insert({
                    contact_id: existing.id, direction: "inbound", channel: "whatsapp",
                    content: m.text?.body ?? "(sem texto)", wa_message_id: m.id,
                  });
                  await supabaseAdmin.from("contacts").update({ last_message_at: new Date().toISOString() }).eq("id", existing.id);
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
