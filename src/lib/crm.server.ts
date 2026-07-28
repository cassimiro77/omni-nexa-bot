// Server-only: pushes leads to the customer's external CRM.
// Configured per workspace in settings (crm_webhook_url + crm_token).

export type LeadPayload = {
  nome: string | null;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  interesse: string | null;
  data_evento: string | null;
  valor_estimado: number | null;
  produto: string | null;
  status: string;
};

export type CrmSettings = {
  crm_enabled?: boolean | null;
  crm_webhook_url?: string | null;
  crm_token?: string | null;
};

export type ContactLike = {
  id: string;
  org_id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  origin?: string | null;
  interest?: string | null;
  event_date?: string | null;
  estimated_value?: number | string | null;
  product?: string | null;
  status?: string | null;
};

export function toLeadPayload(contact: ContactLike): LeadPayload {
  return {
    nome: contact.name ?? null,
    telefone: contact.phone ?? null,
    email: contact.email ?? null,
    origem: contact.origin ?? null,
    interesse: contact.interest ?? null,
    data_evento: contact.event_date ?? null,
    valor_estimado:
      contact.estimated_value === null || contact.estimated_value === undefined
        ? null
        : Number(contact.estimated_value),
    produto: contact.product ?? null,
    status: contact.status ?? "new",
  };
}

/**
 * Sends the lead to the workspace CRM. Returns a result object, never throws,
 * so intake flows keep working when the CRM is offline.
 */
export async function pushLeadToCRM(
  settings: CrmSettings | null | undefined,
  contact: ContactLike,
): Promise<{ ok: boolean; skipped?: boolean; status?: number; crm_lead_id?: string | null; error?: string }> {
  const url = (settings?.crm_webhook_url ?? "").trim();
  if (!settings?.crm_enabled || !url) return { ok: false, skipped: true };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = (settings.crm_token ?? "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const body = {
    source: "nexabot",
    org_id: contact.org_id,
    external_id: contact.id,
    lead: toLeadPayload(contact),
    sent_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const text = await res.text().catch(() => "");
    let crmLeadId: string | null = null;
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      const raw = json.id ?? json.lead_id ?? (json.data as Record<string, unknown> | undefined)?.id;
      if (raw !== undefined && raw !== null) crmLeadId = String(raw);
    } catch {
      /* CRM may reply with plain text */
    }
    return { ok: res.ok, status: res.status, crm_lead_id: crmLeadId, error: res.ok ? undefined : text.slice(0, 400) };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "network error" };
  }
}
