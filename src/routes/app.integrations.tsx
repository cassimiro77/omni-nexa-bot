import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { useOrgId } from "@/hooks/use-org";
import { Plug, Plus, Trash2, Power, CheckCircle2, XCircle, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/app/integrations")({ component: IntegrationsPage });

type Provider = "hubspot" | "rdstation" | "bitrix24" | "zapier" | "n8n" | "custom_webhook";

const PROVIDERS: Record<Provider, { label: string; fields: { key: string; label: string; placeholder?: string; type?: string }[]; help: string; docs: string }> = {
  hubspot: {
    label: "HubSpot (Free CRM)",
    fields: [{ key: "token", label: "Private App Token", placeholder: "pat-na1-...", type: "password" }],
    help: "Crie um Private App em HubSpot → Settings → Integrations → Private Apps com escopos crm.objects.contacts.write.",
    docs: "https://developers.hubspot.com/docs/api/private-apps",
  },
  rdstation: {
    label: "RD Station Marketing (Free)",
    fields: [
      { key: "token", label: "API Key (Public Token)", placeholder: "abc123...", type: "password" },
      { key: "conversion_identifier", label: "Identificador de conversão", placeholder: "nexabot-lead" },
    ],
    help: "Pegue em RD Station → Integrações → API. Todo lead novo vira uma conversão.",
    docs: "https://developers.rdstation.com/reference/conversao",
  },
  bitrix24: {
    label: "Bitrix24 (Free)",
    fields: [{ key: "webhook_url", label: "Inbound Webhook URL", placeholder: "https://sua-conta.bitrix24.com/rest/1/xxxx" }],
    help: "Bitrix24 → Aplicativos → Webhooks → Criar Webhook de Entrada com escopo CRM. Cole a URL sem /crm.lead.add.",
    docs: "https://helpdesk.bitrix24.com/open/17337770/",
  },
  zapier: {
    label: "Zapier",
    fields: [{ key: "webhook_url", label: "Webhook URL", placeholder: "https://hooks.zapier.com/hooks/catch/..." }],
    help: "Zap com trigger 'Webhooks by Zapier → Catch Hook'. Copie a URL gerada.",
    docs: "https://zapier.com/apps/webhook/integrations",
  },
  n8n: {
    label: "n8n",
    fields: [{ key: "webhook_url", label: "Webhook URL", placeholder: "https://n8n.seudominio.com/webhook/..." }],
    help: "Node 'Webhook' em modo POST. Cole a URL de produção.",
    docs: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/",
  },
  custom_webhook: {
    label: "Webhook customizado",
    fields: [{ key: "webhook_url", label: "URL", placeholder: "https://sua-api.com/leads" }],
    help: "Recebe payload JSON com { event, payload, contact }.",
    docs: "",
  },
};

const EVENT_OPTIONS = [
  { value: "contact.created", label: "Novo lead" },
  { value: "contact.status_changed", label: "Status alterado" },
  { value: "message.inbound", label: "Mensagem recebida" },
];

function IntegrationsPage() {
  const qc = useQueryClient();
  const { data: orgId } = useOrgId();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>("hubspot");
  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<string[]>(["contact.created"]);

  const { data } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => (await supabase.from("integrations").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  function reset() {
    setOpen(false); setEditingId(null); setProvider("hubspot"); setName(""); setConfig({}); setEvents(["contact.created"]);
  }

  async function save() {
    if (!name.trim()) return toast.error("Dê um nome à integração");
    const payload = { org_id: orgId!, provider, name, config, events, enabled: true };
    const { error } = editingId
      ? await supabase.from("integrations").update(payload).eq("id", editingId)
      : await supabase.from("integrations").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Integração atualizada" : "Integração criada");
    reset();
    qc.invalidateQueries({ queryKey: ["integrations"] });
  }

  async function toggle(id: string, enabled: boolean) {
    await supabase.from("integrations").update({ enabled: !enabled }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["integrations"] });
  }
  async function remove(id: string) {
    if (!confirm("Excluir integração?")) return;
    await supabase.from("integrations").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["integrations"] });
  }
  function edit(row: { id: string; provider: string; name: string; config: unknown; events: string[] }) {
    setEditingId(row.id); setProvider(row.provider as Provider); setName(row.name);
    setConfig((row.config as Record<string, string>) ?? {}); setEvents(row.events ?? []);
    setOpen(true);
  }

  const meta = PROVIDERS[provider];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
          <p className="text-sm text-muted-foreground">Conecte CRMs e automações. Homologados: HubSpot, RD Station, Bitrix24, Zapier, n8n.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Plus className="h-4 w-4" /> Nova integração
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(data ?? []).map((it) => (
          <div key={it.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Plug className="h-4 w-4 text-primary" />
                <div>
                  <h3 className="font-semibold">{it.name}</h3>
                  <p className="text-xs text-muted-foreground">{PROVIDERS[it.provider as Provider]?.label ?? it.provider}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => toggle(it.id, it.enabled)} className={`rounded-md p-1.5 ${it.enabled ? "text-success" : "text-muted-foreground"}`}><Power className="h-4 w-4" /></button>
                <button onClick={() => remove(it.id)} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {(it.events ?? []).map((e: string) => <span key={e} className="rounded-md bg-accent px-2 py-0.5 text-[10px]">{e}</span>)}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              {it.last_status === "ok" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
              {it.last_status && it.last_status !== "ok" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
              <span className="text-muted-foreground">
                {it.last_sync_at ? `último sync: ${new Date(it.last_sync_at).toLocaleString()}` : "aguardando primeiro evento"}
              </span>
            </div>
            {it.last_error && <p className="mt-1 text-[11px] text-destructive truncate">{it.last_error}</p>}
            <button onClick={() => edit(it)} className="mt-3 text-xs text-primary hover:underline">Editar</button>
          </div>
        ))}
        {data?.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma integração configurada.</div>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{editingId ? "Editar integração" : "Nova integração"}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Provedor</label>
                <select disabled={!!editingId} value={provider} onChange={(e) => { setProvider(e.target.value as Provider); setConfig({}); }}
                  className="mt-1 w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm">
                  {Object.entries(PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">{meta.help}
                  {meta.docs && <> · <a href={meta.docs} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">docs <ExternalLink className="h-3 w-3" /></a></>}
                </p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: HubSpot produção"
                  className="mt-1 w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm" />
              </div>

              {meta.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground">{f.label}</label>
                  <input type={f.type ?? "text"} placeholder={f.placeholder} value={config[f.key] ?? ""}
                    onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm font-mono" />
                </div>
              ))}

              <div>
                <label className="text-xs text-muted-foreground">Eventos que disparam</label>
                <div className="mt-2 space-y-1">
                  {EVENT_OPTIONS.map((e) => (
                    <label key={e.value} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={events.includes(e.value)}
                        onChange={(ev) => setEvents(ev.target.checked ? [...events, e.value] : events.filter((x) => x !== e.value))} />
                      {e.label} <code className="text-[10px] text-muted-foreground">({e.value})</code>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={reset} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
              <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
