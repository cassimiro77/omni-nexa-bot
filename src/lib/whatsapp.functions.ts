import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  contactId: z.string().uuid(),
  content: z.string().min(1).max(4096),
  aiUsed: z.boolean().optional(),
});

export const sendWhatsAppReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: contact, error: cErr } = await supabase
      .from("contacts").select("id, phone, org_id").eq("id", data.contactId).single();
    if (cErr || !contact?.phone) throw new Error("Contato sem telefone");

    const { sendWhatsAppText } = await import("./whatsapp.server");
    const result = await sendWhatsAppText(contact.phone, data.content);

    const nowIso = new Date().toISOString();
    const { error: mErr } = await supabase.from("messages").insert({
      org_id: contact.org_id,
      contact_id: data.contactId,
      direction: "outbound",
      channel: "whatsapp",
      content: data.content,
      ai_used: data.aiUsed ?? false,
      wa_message_id: result.wa_message_id ?? null,
      metadata: result.ok ? { delivered: true } : { delivered: false, error: result.error },
    });
    if (mErr) throw new Error(mErr.message);

    const { data: current } = await supabase.from("contacts").select("status").eq("id", data.contactId).single();
    const patch: { last_message_at: string; status?: string } = { last_message_at: nowIso };
    if (current?.status !== "human" && current?.status !== "human_requested") patch.status = "in_conversation";
    await supabase.from("contacts").update(patch).eq("id", data.contactId);

    await supabase
      .from("handoff_queue")
      .update({ last_operator_message_at: nowIso })
      .eq("contact_id", data.contactId)
      .eq("status", "in_service");

    if (!result.ok) throw new Error(result.error ?? "Falha ao enviar via WhatsApp");
    return { ok: true, wa_message_id: result.wa_message_id };
  });
