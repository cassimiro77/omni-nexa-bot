// Server-only: dispatches events to configured integrations.
// Loaded only inside route handlers via dynamic import.

type Integration = {
  id: string;
  provider: string;
  enabled: boolean;
  config: Record<string, unknown>;
  events: string[];
};

type EventRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
};

async function safeFetch(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const r = await fetch(url, init);
    const text = await r.text().catch(() => "");
    return { ok: r.ok, status: r.status, text: text.slice(0, 500) };
  } catch (e) {
    return { ok: false, status: 0, text: e instanceof Error ? e.message : "network error" };
  }
}

async function toHubSpot(cfg: Record<string, unknown>, event: EventRow, contact: Record<string, unknown> | null) {
  const token = String(cfg.token ?? "");
  if (!token || !contact) return { ok: false, status: 0, text: "missing token or contact" };
  const properties: Record<string, string> = {};
  if (contact.email) properties.email = String(contact.email);
  if (contact.name) properties.firstname = String(contact.name);
  if (contact.phone) properties.phone = String(contact.phone);
  properties.lifecyclestage = "lead";
  return safeFetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ properties }),
  });
}

async function toRDStation(cfg: Record<string, unknown>, event: EventRow, contact: Record<string, unknown> | null) {
  // Free tier: conversions API via token
  const token = String(cfg.token ?? "");
  if (!token || !contact) return { ok: false, status: 0, text: "missing token or contact" };
  const body = {
    event_type: "CONVERSION",
    event_family: "CDP",
    payload: {
      conversion_identifier: String(cfg.conversion_identifier ?? "nexabot-lead"),
      name: contact.name ?? undefined,
      email: contact.email ?? `${contact.phone}@nexabot.local`,
      mobile_phone: contact.phone ?? undefined,
      cf_origem: contact.origin ?? "nexabot",
    },
  };
  return safeFetch(`https://api.rd.services/platform/conversions?api_key=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function toBitrix24(cfg: Record<string, unknown>, event: EventRow, contact: Record<string, unknown> | null) {
  // Uses inbound webhook URL from Bitrix24 (free)
  const webhook = String(cfg.webhook_url ?? "");
  if (!webhook || !contact) return { ok: false, status: 0, text: "missing webhook" };
  const url = webhook.replace(/\/+$/, "") + "/crm.lead.add.json";
  const fields = {
    TITLE: `NexaBot: ${contact.name ?? contact.phone ?? "lead"}`,
    NAME: contact.name ?? undefined,
    PHONE: contact.phone ? [{ VALUE: contact.phone, VALUE_TYPE: "WORK" }] : undefined,
    EMAIL: contact.email ? [{ VALUE: contact.email, VALUE_TYPE: "WORK" }] : undefined,
    SOURCE_DESCRIPTION: `origin=${contact.origin ?? "manual"}`,
  };
  return safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}

async function toGenericWebhook(cfg: Record<string, unknown>, event: EventRow, contact: Record<string, unknown> | null) {
  const url = String(cfg.webhook_url ?? "");
  if (!url) return { ok: false, status: 0, text: "missing url" };
  return safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: event.type, payload: event.payload, contact }),
  });
}

export async function dispatchPending(): Promise<{ dispatched: number; failed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id, type, payload")
    .is("dispatched_at", null)
    .in("type", ["contact.created", "contact.status_changed", "message.inbound"])
    .order("created_at", { ascending: true })
    .limit(50);
  if (!events || events.length === 0) return { dispatched: 0, failed: 0 };

  const { data: integrations } = await supabaseAdmin
    .from("integrations")
    .select("id, provider, enabled, config, events")
    .eq("enabled", true);
  const { data: settings } = await supabaseAdmin
    .from("settings")
    .select("outbound_webhook_url")
    .eq("id", 1)
    .maybeSingle();

  let dispatched = 0;
  let failed = 0;

  for (const ev of events as EventRow[]) {
    // hydrate contact
    let contact: Record<string, unknown> | null = null;
    const contactId = (ev.payload as { contact_id?: string })?.contact_id;
    if (contactId) {
      const { data: c } = await supabaseAdmin
        .from("contacts")
        .select("id, name, phone, email, origin, status, tags")
        .eq("id", contactId)
        .maybeSingle();
      contact = c;
    }

    // 1. legacy single webhook from settings
    if (settings?.outbound_webhook_url) {
      await safeFetch(settings.outbound_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: ev.type, payload: ev.payload, contact }),
      });
    }

    // 2. integrations
    for (const it of (integrations ?? []) as Integration[]) {
      if (!(it.events ?? []).includes(ev.type)) continue;
      let res;
      switch (it.provider) {
        case "hubspot": res = await toHubSpot(it.config, ev, contact); break;
        case "rdstation": res = await toRDStation(it.config, ev, contact); break;
        case "bitrix24": res = await toBitrix24(it.config, ev, contact); break;
        case "zapier":
        case "n8n":
        case "custom_webhook":
        default: res = await toGenericWebhook(it.config, ev, contact); break;
      }
      await supabaseAdmin
        .from("integrations")
        .update({
          last_sync_at: new Date().toISOString(),
          last_status: res.ok ? "ok" : `error ${res.status}`,
          last_error: res.ok ? null : res.text,
        })
        .eq("id", it.id);
      if (!res.ok) failed++;
    }

    await supabaseAdmin.from("events").update({ dispatched_at: new Date().toISOString() }).eq("id", ev.id);
    dispatched++;
  }
  return { dispatched, failed };
}
