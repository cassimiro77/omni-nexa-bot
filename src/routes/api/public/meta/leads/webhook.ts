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

        // Helpers to persist a lead into contacts + messages, plus fire outbound webhook.
        async function persistLead(lead: { name?: string; phone?: string; email?: string; leadgen_id?: string; form_id?: string; ad_id?: string }) {
          const isTestId = lead.leadgen_id && /^4{6,}$/.test(lead.leadgen_id.replace(/[^4]/g, "")); // Meta test payload uses 444444...
          const { data: contact } = await supabaseAdmin.from("contacts").insert({
            name: lead.name ?? (isTestId ? "Lead de teste Meta" : null),
            phone: lead.phone ?? null,
            email: lead.email ?? null,
            origin: "meta_lead_ads",
            status: "new",
            last_message_at: new Date().toISOString(),
            tags: lead.form_id ? [`form:${lead.form_id}`] : [],
          }).select("id").single();

          const { data: settings } = await supabaseAdmin.from("settings").select("welcome_message, outbound_webhook_url").eq("id", 1).single();
          if (contact && settings?.welcome_message) {
            const msg = settings.welcome_message.replace(/\{\{name\}\}/g, lead.name ?? "");
            await supabaseAdmin.from("messages").insert({
              contact_id: contact.id, direction: "outbound", channel: "whatsapp", content: msg, ai_used: false,
            });
          }
          if (settings?.outbound_webhook_url) {
            fetch(settings.outbound_webhook_url, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event: "new_lead", contact: lead }),
            }).catch((e) => console.error("outbound webhook", e));
          }
        }

        // Fetch lead details from Meta Graph API using leadgen_id + page access token.
        async function fetchLeadFromGraph(leadgenId: string) {
          const token = process.env.META_PAGE_ACCESS_TOKEN;
          if (!token) return null;
          try {
            const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(leadgenId)}?fields=field_data,created_time,ad_id,form_id&access_token=${encodeURIComponent(token)}`;
            const r = await fetch(url);
            if (!r.ok) {
              console.error("Graph fetch lead failed", r.status, (await r.text()).slice(0, 500));
              return null;
            }
            return await r.json() as { field_data?: { name: string; values: string[] }[]; ad_id?: string; form_id?: string };
          } catch (e) { console.error("Graph fetch error", e); return null; }
        }

        function parseFieldData(fd: { name: string; values: string[] }[] | undefined) {
          const out: { name?: string; phone?: string; email?: string } = {};
          for (const f of fd ?? []) {
            const key = f.name.toLowerCase();
            const value = f.values?.[0];
            if (!value) continue;
            if (key.includes("email")) out.email = value;
            else if (key.includes("phone") || key.includes("telefone") || key.includes("celular")) out.phone = value;
            else if (key === "full_name" || key === "name" || key.includes("nome")) out.name = value;
          }
          return out;
        }

        try {
          // Shape A: Meta webhook: entry[].changes[].value.leadgen_id
          const p = payload as { entry?: { changes?: { field?: string; value?: { leadgen_id?: string; form_id?: string; ad_id?: string } }[] }[] };
          const entries = p.entry ?? [];
          let handled = false;
          for (const e of entries) {
            for (const c of e.changes ?? []) {
              if (c.field !== "leadgen") continue;
              const v = c.value ?? {};
              const leadgenId = v.leadgen_id;
              if (!leadgenId) continue;
              handled = true;
              const isTest = /^4+$/.test(leadgenId);
              let fields: { name?: string; phone?: string; email?: string } = {};
              if (!isTest) {
                const graph = await fetchLeadFromGraph(leadgenId);
                fields = parseFieldData(graph?.field_data);
              }
              await persistLead({ ...fields, leadgen_id: leadgenId, form_id: v.form_id, ad_id: v.ad_id });
            }
          }

          // Shape B: Direct test payload { name, phone, email }
          if (!handled) {
            const direct = payload as { name?: string; phone?: string; email?: string };
            if (direct.phone || direct.name || direct.email) {
              await persistLead(direct);
            }
          }
        } catch (e) { console.error("lead parse", e); }

        return Response.json({ ok: true });
      },
    },
  },
});
