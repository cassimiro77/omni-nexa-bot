// Server-only: shared lead intake used by the public form endpoint,
// Meta Lead Ads webhook and any other capture source.
// Always scoped to a single org_id (multi-tenant isolation).

import { pushLeadToCRM, type ContactLike } from "./crm.server";

export type LeadInput = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  origin?: string | null;
  interest?: string | null;
  event_date?: string | null;
  estimated_value?: number | null;
  product?: string | null;
  metadata?: Record<string, unknown>;
};

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return digits.length <= 11 ? `55${digits}` : digits;
}

/**
 * Creates or updates the contact for this org, logs the lead event,
 * pushes it to the workspace CRM and (optionally) opens the WhatsApp
 * conversation with the welcome message.
 */
export async function intakeLead(
  orgId: string,
  input: LeadInput,
  options: { startConversation?: boolean } = {},
): Promise<{ contactId: string; created: boolean; crm: { ok: boolean; skipped?: boolean; error?: string } }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const phone = normalizePhone(input.phone);
  const email = input.email?.trim().toLowerCase() || null;

  let existing: { id: string; status: string } | null = null;
  if (phone) {
    const { data } = await supabaseAdmin
      .from("contacts").select("id, status").eq("org_id", orgId).eq("phone", phone).maybeSingle();
    existing = data as { id: string; status: string } | null;
  }
  if (!existing && email) {
    const { data } = await supabaseAdmin
      .from("contacts").select("id, status").eq("org_id", orgId).eq("email", email).maybeSingle();
    existing = data as { id: string; status: string } | null;
  }

  const patch = {
    name: input.name?.trim() || undefined,
    phone: phone ?? undefined,
    email: email ?? undefined,
    origin: input.origin ?? "form",
    interest: input.interest ?? undefined,
    event_date: input.event_date || undefined,
    estimated_value: input.estimated_value ?? undefined,
    product: input.product ?? undefined,
    metadata: (input.metadata ?? undefined) as never,
  };

  let contactId: string;
  let created = false;
  if (existing) {
    contactId = existing.id;
    await supabaseAdmin.from("contacts").update({
      ...patch,
      closed_at: null,
      close_reason: null,
      status: existing.status === "closed" ? "new" : existing.status,
    }).eq("id", contactId);
  } else {
    const { data, error } = await supabaseAdmin.from("contacts").insert({
      org_id: orgId,
      status: "new",
      ...patch,
    }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Falha ao criar contato");
    contactId = data.id as string;
    created = true;
  }

  await supabaseAdmin.from("events").insert({
    org_id: orgId,
    type: created ? "contact.created" : "lead.updated",
    payload: { contact_id: contactId, origin: patch.origin, source: "lead_intake" } as never,
  });

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("id, org_id, name, phone, email, origin, interest, event_date, estimated_value, product, status")
    .eq("id", contactId)
    .single();

  const { data: settings } = await supabaseAdmin
    .from("settings")
    .select("crm_enabled, crm_webhook_url, crm_token, welcome_message, wa_phone_number_id, wa_token")
    .eq("org_id", orgId)
    .maybeSingle();

  const crm = await pushLeadToCRM(settings, (contact ?? { id: contactId, org_id: orgId }) as ContactLike);
  if (crm.ok) {
    await supabaseAdmin.from("contacts").update({
      crm_lead_id: crm.crm_lead_id ?? null,
      crm_synced_at: new Date().toISOString(),
    }).eq("id", contactId);
  }
  await supabaseAdmin.from("events").insert({
    org_id: orgId,
    type: crm.skipped ? "crm.skipped" : crm.ok ? "crm.lead_created" : "crm.lead_failed",
    payload: { contact_id: contactId, status: crm.status ?? null, error: crm.error ?? null } as never,
  });

  // Kick off the WhatsApp conversation right after the form is submitted.
  if (options.startConversation && phone && settings?.welcome_message?.trim()) {
    const { sendWhatsAppText } = await import("./whatsapp.server");
    const text = settings.welcome_message.trim().replace(/\{\{\s*nome\s*\}\}/gi, input.name?.split(" ")[0] ?? "");
    const sent = await sendWhatsAppText(phone, text, {
      token: settings.wa_token,
      phoneId: settings.wa_phone_number_id,
    });
    await supabaseAdmin.from("messages").insert({
      org_id: orgId,
      contact_id: contactId,
      direction: "outbound",
      channel: "whatsapp",
      content: text,
      ai_used: false,
      wa_message_id: sent.wa_message_id ?? null,
      metadata: { welcome: true, from_form: true, delivered: sent.ok } as never,
    });
    if (sent.ok) {
      await supabaseAdmin.from("contacts")
        .update({ status: "in_conversation", last_message_at: new Date().toISOString() })
        .eq("id", contactId);
    }
  }

  return { contactId, created, crm: { ok: crm.ok, skipped: crm.skipped, error: crm.error } };
}
