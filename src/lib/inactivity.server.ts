// Server-only: closes conversations that went silent past the workspace timeout.

export async function closeContact(
  orgId: string,
  contactId: string,
  reason: "timeout" | "customer_declined" | "won" | "manual",
  notice?: { phone: string | null; text: string; creds?: { token?: string | null; phoneId?: string | null } },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (notice?.phone && notice.text) {
    const { sendWhatsAppText } = await import("./whatsapp.server");
    const sent = await sendWhatsAppText(notice.phone, notice.text, notice.creds);
    await supabaseAdmin.from("messages").insert({
      org_id: orgId,
      contact_id: contactId,
      direction: "outbound",
      channel: "whatsapp",
      content: notice.text,
      ai_used: false,
      wa_message_id: sent.wa_message_id ?? null,
      metadata: { closing: true, reason, delivered: sent.ok } as never,
    });
  }

  await supabaseAdmin.from("contacts").update({
    status: "closed",
    closed_at: new Date().toISOString(),
    close_reason: reason,
  }).eq("id", contactId);

  await supabaseAdmin.from("events").insert({
    org_id: orgId,
    type: "contact.status_changed",
    payload: { contact_id: contactId, status: "closed", reason } as never,
  });

  // Keep the CRM in sync with the final status.
  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("id, org_id, name, phone, email, origin, interest, event_date, estimated_value, product, status")
    .eq("id", contactId)
    .maybeSingle();
  const { data: settings } = await supabaseAdmin
    .from("settings").select("crm_enabled, crm_webhook_url, crm_token").eq("org_id", orgId).maybeSingle();
  if (contact) {
    const { pushLeadToCRM } = await import("./crm.server");
    await pushLeadToCRM(settings, contact as never);
  }
}

/** Closes every conversation idle for longer than settings.inactivity_close_min. */
export async function tickInactivity(): Promise<{ closed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: allSettings } = await supabaseAdmin
    .from("settings")
    .select("org_id, inactivity_close_min, wa_token, wa_phone_number_id, business_name");

  let closed = 0;
  for (const s of (allSettings ?? []) as Array<{
    org_id: string; inactivity_close_min: number | null; wa_token: string | null;
    wa_phone_number_id: string | null; business_name: string | null;
  }>) {
    const minutes = s.inactivity_close_min ?? 0;
    if (!minutes || minutes <= 0) continue;
    const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();

    const { data: stale } = await supabaseAdmin
      .from("contacts")
      .select("id, phone, last_message_at, created_at")
      .eq("org_id", s.org_id)
      .in("status", ["new", "in_conversation"])
      .lt("last_message_at", cutoff)
      .limit(50);

    for (const c of (stale ?? []) as Array<{ id: string; phone: string | null }>) {
      const text = `Vou encerrar nosso atendimento por aqui, tudo bem? Se precisar é só mandar uma mensagem que eu retomo na hora. 💛 — ${s.business_name ?? "Atendimento"}`;
      await closeContact(s.org_id, c.id, "timeout", {
        phone: c.phone,
        text,
        creds: { token: s.wa_token, phoneId: s.wa_phone_number_id },
      });
      closed++;
    }
  }
  return { closed };
}
