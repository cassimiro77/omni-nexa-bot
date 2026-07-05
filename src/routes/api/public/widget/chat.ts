// Public chat endpoint for the embeddable Nexbot widget.
// CORS: open (used by external sites). Rate limiting is trivial per-session.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const schema = z.object({
  source: z.string().trim().min(1).max(40),
  sessionId: z.string().trim().min(6).max(80),
  message: z.string().trim().min(1).max(2000),
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(200).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(20)
    .optional(),
});

export const Route = createFileRoute("/api/public/widget/chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400, headers: CORS });
        }
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          return Response.json({ error: "invalid_input", details: parsed.error.flatten() }, { status: 400, headers: CORS });
        }
        const { source, sessionId, message, name, email, history } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Upsert-ish contact by (origin, metadata.session_id)
        const { data: existing } = await supabaseAdmin
          .from("contacts")
          .select("id, name, email, metadata")
          .eq("origin", source)
          .contains("metadata", { session_id: sessionId })
          .maybeSingle();

        let contactId = existing?.id as string | undefined;
        let justCapturedEmail = false;
        if (!contactId) {
          const { data: ins, error: insErr } = await supabaseAdmin
            .from("contacts")
            .insert({
              origin: source,
              name: name ?? null,
              email: email ?? null,
              status: "new",
              metadata: { session_id: sessionId, channel: "widget" },
            })
            .select("id")
            .single();
          if (insErr) return Response.json({ error: insErr.message }, { status: 500, headers: CORS });
          contactId = ins.id;
          if (email) justCapturedEmail = true;
        } else if (name || email) {
          if (email && !existing?.email) justCapturedEmail = true;
          await supabaseAdmin
            .from("contacts")
            .update({
              name: name ?? existing?.name ?? null,
              email: email ?? existing?.email ?? null,
            })
            .eq("id", contactId);
        }

        // Fire-and-forget: send contact confirmation the first time we see an email
        if (justCapturedEmail && email) {
          const siteName = source === "nexalytix" ? "Nexalytix" : source === "bolo-memoria" ? "Bolo & Memória" : "NexaBot";
          import("@/lib/email-internal.server").then(({ enqueueTransactionalEmail }) =>
            enqueueTransactionalEmail({
              templateName: "contact-confirmation",
              recipientEmail: email,
              templateData: { name: name ?? undefined, siteName },
              label: `contact-confirmation:${source}`,
            }).catch((err) => console.error("contact-confirmation enqueue failed", err)),
          );
        }

        // Store inbound message
        await supabaseAdmin.from("messages").insert({
          contact_id: contactId,
          direction: "inbound",
          channel: "widget",
          content: message,
          metadata: { source, session_id: sessionId },
        });

        // If the contact was handed off to a human, don't auto-reply.
        const { data: c } = await supabaseAdmin
          .from("contacts")
          .select("status")
          .eq("id", contactId)
          .maybeSingle();
        if (c?.status === "human" || c?.status === "human_requested") {
          await supabaseAdmin
            .from("contacts")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", contactId);
          return Response.json(
            { reply: "Um atendente foi acionado e responderá por aqui em breve.", handoff: true },
            { headers: CORS },
          );
        }

        // AI reply
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "ai_unavailable" }, { status: 500, headers: CORS });
        }

        const { data: settings } = await supabaseAdmin
          .from("settings")
          .select("ai_system_prompt, business_name, welcome_message, source_prompts")
          .eq("id", 1)
          .maybeSingle();

        const sourcePrompts = (settings?.source_prompts as Record<string, string> | null) ?? {};
        const brandHint =
          sourcePrompts[source] ||
          (source === "nexalytix"
            ? "Você atende visitantes do site Nexalytix (analytics/BI)."
            : source === "bolo-memoria" || source === "bolo_memoria" || source === "bolo-e-memoria"
              ? "Você atende clientes da confeitaria Bolo & Memória."
              : `Você atende visitantes do site (${source}).`);

        const sys = `${settings?.ai_system_prompt ?? "Você é um assistente cordial."}\n\n[Contexto do site — ${source}]\n${brandHint}\n\nNegócio: ${settings?.business_name ?? "NexaBot"}. Responda em português, curto e direto. Se o cliente pedir atendente humano, confirme que vai transferir e responda apenas: "Ok, vou chamar um atendente. Aguarde um momento."`;

        const msgs = [
          { role: "system" as const, content: sys },
          ...(history ?? []).slice(-12),
          { role: "user" as const, content: message },
        ];

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: msgs }),
        });
        if (!aiRes.ok) {
          const t = await aiRes.text().catch(() => "");
          return Response.json({ error: "ai_error", detail: t.slice(0, 200) }, { status: 502, headers: CORS });
        }
        const j = (await aiRes.json()) as { choices?: { message?: { content?: string } }[] };
        const reply = j.choices?.[0]?.message?.content?.trim() || "Desculpe, não entendi. Pode reformular?";

        // Detect handoff keywords
        const lc = message.toLowerCase();
        const wantsHuman = /atendente|humano|falar com|pessoa|suporte real/.test(lc);
        const newStatus = wantsHuman ? "human_requested" : "in_conversation";

        await supabaseAdmin.from("messages").insert({
          contact_id: contactId,
          direction: "outbound",
          channel: "widget",
          content: reply,
          ai_used: true,
          metadata: { source, session_id: sessionId, auto_reply: true },
        });

        await supabaseAdmin
          .from("contacts")
          .update({ last_message_at: new Date().toISOString(), status: newStatus })
          .eq("id", contactId);

        return Response.json({ reply, handoff: wantsHuman }, { headers: CORS });
      },
    },
  },
});
