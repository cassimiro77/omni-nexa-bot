import { createFileRoute } from "@tanstack/react-router";

// Handoff queue tick — invoked by pg_cron every minute.
// Processes waiting/in_service tickets: initial alerts, customer notice,
// supervisor escalation, recurring reminders, optional auto-return timeout.
export const Route = createFileRoute("/api/public/handoff/tick")({
  server: {
    handlers: {
      POST: async () => runTick(),
      GET: async () => runTick(),
    },
  },
});

async function runTick() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendWhatsAppText } = await import("@/lib/whatsapp.server");

  const { data: settings } = await supabaseAdmin
    .from("settings")
    .select("handoff_alert_phone, handoff_supervisor_phone, handoff_wait_customer_min, handoff_escalate_min, handoff_reminder_interval_min, handoff_auto_return_min, business_name")
    .eq("id", 1)
    .maybeSingle();

  const alertPhone = settings?.handoff_alert_phone?.trim() || null;
  const supPhone = settings?.handoff_supervisor_phone?.trim() || null;
  const waitCustomerMin = settings?.handoff_wait_customer_min ?? 30;
  const escalateMin = settings?.handoff_escalate_min ?? 70;
  const reminderMin = settings?.handoff_reminder_interval_min ?? 30;
  const autoReturnMin = settings?.handoff_auto_return_min ?? null;

  const { data: tickets } = await supabaseAdmin
    .from("handoff_queue")
    .select("id, contact_id, status, requested_at, assigned_at, last_alert_at, alert_count, escalated_at, customer_notified_at, last_operator_message_at, contacts(name, phone)")
    .in("status", ["waiting", "in_service"]);

  const now = Date.now();
  const results: Record<string, unknown>[] = [];

  for (const t of tickets ?? []) {
    const contact = (t as { contacts?: { name?: string | null; phone?: string | null } }).contacts;
    const name = contact?.name ?? "Contato";
    const phone = contact?.phone ?? "?";
    const waitedMs = now - new Date(t.requested_at).getTime();
    const waitedMin = Math.floor(waitedMs / 60000);

    // === Initial alert (fires as soon as ticket exists) ===
    if (t.status === "waiting" && t.alert_count === 0 && alertPhone) {
      const msg = `🔔 Novo pedido de atendimento humano\n\nCliente: ${name}\nTelefone: ${phone}\nAguardando há ${waitedMin} min.\n\nAcesse a fila para assumir.`;
      const r = await sendWhatsAppText(alertPhone, msg);
      await supabaseAdmin
        .from("handoff_queue")
        .update({ alert_count: 1, last_alert_at: new Date().toISOString() })
        .eq("id", t.id);
      results.push({ id: t.id, action: "initial_alert", ok: r.ok });
    }

    // === Customer notice (bot tells the client the operator is busy) ===
    if (
      t.status === "waiting" &&
      !t.customer_notified_at &&
      waitedMin >= waitCustomerMin &&
      phone && phone !== "?"
    ) {
      const notice = `Olá! Você já foi direcionado a um atendente. Ele(a) está finalizando outro atendimento e conversa com você em instantes. Obrigado pela paciência! 🙏`;
      const r = await sendWhatsAppText(phone, notice);
      if (r.ok) {
        await supabaseAdmin.from("messages").insert({
          contact_id: t.contact_id,
          direction: "outbound",
          channel: "whatsapp",
          content: notice,
          ai_used: false,
          wa_message_id: r.wa_message_id ?? null,
          metadata: { handoff_wait_notice: true },
        });
      }
      await supabaseAdmin
        .from("handoff_queue")
        .update({ customer_notified_at: new Date().toISOString() })
        .eq("id", t.id);
      results.push({ id: t.id, action: "customer_notice", ok: r.ok });
    }

    // === Supervisor escalation ===
    if (t.status === "waiting" && !t.escalated_at && waitedMin >= escalateMin && supPhone) {
      const msg = `⚠️ Escalonamento: atendimento de ${name} (${phone}) sem resposta há ${waitedMin} min. Por favor, verifique a equipe.`;
      const r = await sendWhatsAppText(supPhone, msg);
      await supabaseAdmin
        .from("handoff_queue")
        .update({ escalated_at: new Date().toISOString() })
        .eq("id", t.id);
      results.push({ id: t.id, action: "escalate", ok: r.ok });
    }

    // === Recurring reminder to alert phone ===
    if (t.status === "waiting" && alertPhone && t.last_alert_at) {
      const sinceLast = now - new Date(t.last_alert_at).getTime();
      if (sinceLast >= reminderMin * 60000) {
        const msg = `⏰ Atendimento pendente há ${waitedMin} min\n\nCliente: ${name}\nTelefone: ${phone}`;
        const r = await sendWhatsAppText(alertPhone, msg);
        await supabaseAdmin
          .from("handoff_queue")
          .update({ last_alert_at: new Date().toISOString(), alert_count: (t.alert_count ?? 0) + 1 })
          .eq("id", t.id);
        results.push({ id: t.id, action: "reminder", ok: r.ok });
      }
    }

    // === Auto-return timeout (optional) ===
    if (
      t.status === "in_service" &&
      autoReturnMin &&
      autoReturnMin > 0 &&
      t.assigned_at
    ) {
      const idleSince = t.last_operator_message_at ?? t.assigned_at;
      const idleMs = now - new Date(idleSince).getTime();
      if (idleMs >= autoReturnMin * 60000) {
        await supabaseAdmin
          .from("handoff_queue")
          .update({ status: "abandoned", resolved_at: new Date().toISOString() })
          .eq("id", t.id);
        await supabaseAdmin
          .from("contacts")
          .update({ status: "in_conversation" })
          .eq("id", t.contact_id);
        if (supPhone) {
          await sendWhatsAppText(
            supPhone,
            `⚠️ Timeout: atendimento de ${name} (${phone}) foi devolvido ao bot após ${autoReturnMin} min sem resposta do operador.`
          );
        }
        results.push({ id: t.id, action: "auto_return" });
      }
    }
  }

  return Response.json({ ok: true, processed: results.length, results });
}
