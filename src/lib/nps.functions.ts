import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IdSchema = z.object({ contactId: z.string().uuid() });

// Sends an NPS invite via WhatsApp and marks the contact as awaiting_nps.
export const sendNPSInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: contact } = await supabase.from("contacts").select("phone, name").eq("id", data.contactId).single();
    if (!contact?.phone) throw new Error("Contato sem telefone");

    const message = `Obrigado pelo contato${contact.name ? ", " + contact.name : ""}! 🙏\n\nDe 0 a 10, qual a chance de você nos recomendar? Responda apenas com o número.`;

    const { sendWhatsAppText } = await import("./whatsapp.server");
    const send = await sendWhatsAppText(contact.phone, message);
    if (!send.ok) throw new Error(send.error ?? "Falha ao enviar");

    await supabase.from("messages").insert({
      contact_id: data.contactId, direction: "outbound", channel: "whatsapp",
      content: message, ai_used: false, wa_message_id: send.wa_message_id ?? null,
      metadata: { nps_invite: true },
    });
    await supabase.from("contacts")
      .update({ awaiting_nps: true, last_message_at: new Date().toISOString(), status: "converted" })
      .eq("id", data.contactId);

    return { ok: true };
  });

export const getNPSStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const { data } = await context.supabase.from("nps_responses").select("score, created_at").gte("created_at", since);
    const scores = (data ?? []).map((r) => r.score);
    const total = scores.length;
    const promoters = scores.filter((s) => s >= 9).length;
    const detractors = scores.filter((s) => s <= 6).length;
    const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
    const avg = total > 0 ? Number((scores.reduce((a, b) => a + b, 0) / total).toFixed(1)) : 0;
    return { total, nps, avg, promoters, detractors, passives: total - promoters - detractors };
  });
