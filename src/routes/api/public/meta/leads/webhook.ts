import { createFileRoute } from "@tanstack/react-router";

// Meta Lead Ads webhook.
export const Route = createFileRoute("/api/public/meta/leads/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const verifyToken = process.env.META_WA_VERIFY_TOKEN ?? "MOCK_VERIFY_TOKEN";
        if (mode === "subscribe" && token === verifyToken && challenge) return new Response(challenge, { status: 200 });
        return new Response("forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
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
        await supabaseAdmin.from("events").insert({ type: "meta.lead", payload: payload as never });

        // Accept two shapes:
        //  A) Meta webhook: entry[].changes[].value.leadgen_id (needs Graph API to fetch fields — mock only)
        //  B) Direct test payload: { name, phone, email }
        try {
          const direct = payload as { name?: string; phone?: string; email?: string };
          if (direct.phone || direct.name || direct.email) {
            const { data: contact } = await supabaseAdmin.from("contacts").insert({
              name: direct.name, phone: direct.phone, email: direct.email,
              origin: "meta_lead_ads", status: "new", last_message_at: new Date().toISOString(),
            }).select("id").single();

            const { data: settings } = await supabaseAdmin.from("settings").select("welcome_message, outbound_webhook_url").eq("id", 1).single();
            if (contact && settings?.welcome_message) {
              const msg = settings.welcome_message.replace(/\{\{name\}\}/g, direct.name ?? "");
              await supabaseAdmin.from("messages").insert({
                contact_id: contact.id, direction: "outbound", channel: "whatsapp", content: msg, ai_used: false,
              });
            }
            if (settings?.outbound_webhook_url) {
              fetch(settings.outbound_webhook_url, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ event: "new_lead", contact: direct }),
              }).catch((e) => console.error("outbound webhook", e));
            }
          }
        } catch (e) { console.error("lead parse", e); }

        return Response.json({ ok: true });
      },
    },
  },
});
