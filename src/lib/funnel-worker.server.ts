// Funnel worker — advances funnel_runs whose next_run_at is due.
type Step = {
  type: "send_message" | "wait" | "add_tag" | "call_webhook";
  content?: string;
  seconds?: number;
  tag?: string;
  url?: string;
};

function interpolate(tpl: string, ctx: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(ctx[k] ?? ""));
}

export async function tickFunnels(): Promise<{ advanced: number; completed: number; failed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const nowIso = new Date().toISOString();
  const { data: due } = await supabaseAdmin
    .from("funnel_runs")
    .select("id, funnel_id, contact_id, current_step")
    .eq("status", "running")
    .lte("next_run_at", nowIso)
    .limit(50);

  if (!due || due.length === 0) return { advanced: 0, completed: 0, failed: 0 };

  let advanced = 0;
  let completed = 0;
  let failed = 0;

  for (const run of due) {
    try {
      const { data: funnel } = await supabaseAdmin.from("funnels").select("steps, active").eq("id", run.funnel_id).maybeSingle();
      const { data: contact } = await supabaseAdmin.from("contacts").select("*").eq("id", run.contact_id).maybeSingle();
      if (!funnel || !funnel.active || !contact) {
        await supabaseAdmin.from("funnel_runs").update({ status: "cancelled" }).eq("id", run.id);
        continue;
      }
      const steps = (funnel.steps ?? []) as Step[];
      const step = steps[run.current_step];
      if (!step) {
        await supabaseAdmin.from("funnel_runs").update({ status: "completed" }).eq("id", run.id);
        completed++;
        continue;
      }

      const ctx = { name: contact.name ?? "", phone: contact.phone ?? "", email: contact.email ?? "" };
      let nextRunAt = new Date();

      switch (step.type) {
        case "send_message": {
          const content = interpolate(step.content ?? "", ctx);
          if (content) {
            let wa_message_id: string | null = null;
            let delivered = false;
            let sendError: string | undefined;
            if (contact.phone) {
              const { sendWhatsAppText } = await import("./whatsapp.server");
              const r = await sendWhatsAppText(contact.phone, content);
              delivered = r.ok;
              wa_message_id = r.wa_message_id ?? null;
              sendError = r.error;
            }
            await supabaseAdmin.from("messages").insert({
              contact_id: run.contact_id,
              direction: "outbound",
              content,
              ai_used: false,
              channel: "whatsapp",
              wa_message_id,
              metadata: { source: "funnel", funnel_id: run.funnel_id, delivered, error: sendError },
            });
            await supabaseAdmin.from("contacts").update({ last_message_at: nextRunAt.toISOString() }).eq("id", run.contact_id);
          }
          break;
        }
        case "wait": {
          nextRunAt = new Date(Date.now() + Math.max(1, step.seconds ?? 5) * 1000);
          break;
        }
        case "add_tag": {
          const tag = step.tag ?? "";
          if (tag) {
            const tags = Array.isArray(contact.tags) ? contact.tags : [];
            if (!tags.includes(tag)) await supabaseAdmin.from("contacts").update({ tags: [...tags, tag] }).eq("id", run.contact_id);
          }
          break;
        }
        case "call_webhook": {
          if (step.url) {
            await fetch(step.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event: "funnel.step", contact, step }),
            }).catch(() => null);
          }
          break;
        }
      }

      const nextStep = run.current_step + 1;
      const isDone = nextStep >= steps.length;
      await supabaseAdmin
        .from("funnel_runs")
        .update({
          current_step: nextStep,
          next_run_at: nextRunAt.toISOString(),
          status: isDone ? "completed" : "running",
          last_error: null,
        })
        .eq("id", run.id);
      if (isDone) completed++;
      else advanced++;
    } catch (e) {
      failed++;
      await supabaseAdmin
        .from("funnel_runs")
        .update({ status: "failed", last_error: e instanceof Error ? e.message : "unknown" })
        .eq("id", run.id);
    }
  }
  return { advanced, completed, failed };
}
