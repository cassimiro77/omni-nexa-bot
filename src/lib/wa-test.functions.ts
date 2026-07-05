import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(8).max(20),
  mode: z.enum(["freeform", "template"]),
  message: z.string().trim().max(1000).optional(),
  templateName: z.string().trim().max(80).optional(),
  languageCode: z.string().trim().max(10).optional(),
});

export const sendTestWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => schema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Admin only
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");

    const phoneClean = data.phone.replace(/[^\d]/g, "");
    if (phoneClean.length < 8) throw new Error("Telefone inválido.");

    const { sendWhatsAppText, sendWhatsAppTemplate } = await import("@/lib/whatsapp.server");

    // Upsert contact
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("phone", phoneClean)
      .maybeSingle();

    let contactId = existing?.id as string | undefined;
    if (!contactId) {
      const { data: inserted, error: insErr } = await supabase
        .from("contacts")
        .insert({ name: data.name, phone: phoneClean, origin: "admin_test", status: "new" })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      contactId = inserted.id;
    } else {
      await supabase.from("contacts").update({ name: data.name }).eq("id", contactId);
    }

    // Send
    let result: { ok: boolean; wa_message_id?: string; error?: string };
    let bodyLogged = "";
    if (data.mode === "freeform") {
      const msg = (data.message ?? "").trim();
      if (!msg) throw new Error("Mensagem obrigatória no modo livre.");
      bodyLogged = msg;
      result = await sendWhatsAppText(phoneClean, msg);
    } else {
      const tpl = data.templateName?.trim() || "hello_world";
      const lang = data.languageCode?.trim() || "en_US";
      bodyLogged = `[template:${tpl}/${lang}]`;
      result = await sendWhatsAppTemplate(phoneClean, tpl, lang);
    }

    // Log message
    await supabase.from("messages").insert({
      contact_id: contactId,
      channel: "whatsapp",
      direction: "outbound",
      content: bodyLogged,
      wa_message_id: result.wa_message_id ?? null,
      metadata: {
        source: "admin_test",
        mode: data.mode,
        ok: result.ok,
        error: result.error ?? null,
      },
    });

    if (!result.ok) throw new Error(result.error ?? "Falha no envio.");
    return { ok: true, contactId, waMessageId: result.wa_message_id };
  });
