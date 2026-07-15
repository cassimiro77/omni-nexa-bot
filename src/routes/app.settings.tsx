import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity, Copy, KeyRound, Webhook, Bot, Mail, Users } from "lucide-react";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("settings").select("*").eq("id", 1).single()).data,
  });
  const { data: lastWhatsappEvent } = useQuery({
    queryKey: ["last-whatsapp-event"],
    queryFn: async () => {
      const { data: event } = await supabase
        .from("events")
        .select("created_at, type, payload")
        .like("type", "whatsapp.%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return event;
    },
  });

  const [form, setForm] = useState({
    business_name: "", ai_system_prompt: "", welcome_message: "", outbound_webhook_url: "",
    handoff_alert_phone: "", handoff_supervisor_phone: "",
    handoff_wait_customer_min: 30, handoff_escalate_min: 70, handoff_reminder_interval_min: 30,
    handoff_auto_return_min: 0,
  });

  useEffect(() => {
    if (data) setForm({
      business_name: data.business_name ?? "",
      ai_system_prompt: data.ai_system_prompt ?? "",
      welcome_message: data.welcome_message ?? "",
      outbound_webhook_url: data.outbound_webhook_url ?? "",
      handoff_alert_phone: (data as { handoff_alert_phone?: string }).handoff_alert_phone ?? "",
      handoff_supervisor_phone: (data as { handoff_supervisor_phone?: string }).handoff_supervisor_phone ?? "",
      handoff_wait_customer_min: (data as { handoff_wait_customer_min?: number }).handoff_wait_customer_min ?? 30,
      handoff_escalate_min: (data as { handoff_escalate_min?: number }).handoff_escalate_min ?? 70,
      handoff_reminder_interval_min: (data as { handoff_reminder_interval_min?: number }).handoff_reminder_interval_min ?? 30,
      handoff_auto_return_min: (data as { handoff_auto_return_min?: number | null }).handoff_auto_return_min ?? 0,
    });
  }, [data]);

  async function save() {
    const { error } = await supabase.from("settings").update(form).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  const origin = "https://project--e0efd13b-a401-4810-b28e-430a1d408866.lovable.app";
  const publicOrigin = "https://omni-nexa-bot.lovable.app";
  const waWebhook = `${origin}/api/public/whatsapp/webhook`;
  const leadsWebhook = `${origin}/api/public/meta/leads/webhook`;

  function copy(v: string) { navigator.clipboard.writeText(v); toast.success("Copiado"); }

  return (
    <div className="p-8 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Ajuste o bot, IA e integrações externas.</p>
      </header>

      <section className="space-y-6">
        <Card icon={<Bot className="h-4 w-4" />} title="Identidade">
          <Field label="Nome do negócio">
            <input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Mensagem de boas-vindas">
            <textarea value={form.welcome_message} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} rows={2} className={inputCls} />
          </Field>
        </Card>

        <Card icon={<Bot className="h-4 w-4" />} title="IA (Lovable AI Gateway · Gemini)">
          <Field label="System prompt">
            <textarea value={form.ai_system_prompt} onChange={(e) => setForm({ ...form, ai_system_prompt: e.target.value })} rows={5} className={inputCls} />
          </Field>
          <p className="text-xs text-muted-foreground">Usado pela IA ao gerar respostas no Inbox.</p>
        </Card>

        <Card icon={<Webhook className="h-4 w-4" />} title="Webhook externo (Zapier/Make/n8n)">
          <Field label="URL de saída">
            <input value={form.outbound_webhook_url} onChange={(e) => setForm({ ...form, outbound_webhook_url: e.target.value })} placeholder="https://hooks.zapier.com/…" className={inputCls} />
          </Field>
          <p className="text-xs text-muted-foreground">Cada novo lead pode ser enviado a esta URL para acionar seu CRM/ERP.</p>
        </Card>

        <Card icon={<KeyRound className="h-4 w-4" />} title="URLs de webhook (configure na Meta)">
          <ReadOnly label="WhatsApp Cloud API" value={waWebhook} onCopy={() => copy(waWebhook)} />
          <ReadOnly label="WhatsApp Cloud API (domínio publicado)" value={`${publicOrigin}/api/public/whatsapp/webhook`} onCopy={() => copy(`${publicOrigin}/api/public/whatsapp/webhook`)} />
          <ReadOnly label="Meta Lead Ads" value={leadsWebhook} onCopy={() => copy(leadsWebhook)} />
          <p className="text-xs text-muted-foreground">
            Use uma dessas URLs públicas no painel da Meta. A URL do Preview ou da tela de login não deve ser usada como Callback URL.
          </p>
        </Card>

        <Card icon={<Activity className="h-4 w-4" />} title="Diagnóstico WhatsApp">
          <div className="rounded-md border border-border bg-background/50 p-3 text-sm">
            <div className="font-medium">Última chamada recebida</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {lastWhatsappEvent?.created_at ? new Date(lastWhatsappEvent.created_at).toLocaleString("pt-BR") : "Nenhuma chamada registrada"}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Tipo: {lastWhatsappEvent?.type ?? "—"}</div>
          </div>
          <p className="text-xs text-muted-foreground">
            Se você enviar mensagem pelo WhatsApp e este horário não mudar, a Meta ainda não está chamando a URL correta do webhook.
          </p>
        </Card>

        <Card icon={<Mail className="h-4 w-4" />} title="Domínio de e-mail">
          <p className="text-sm text-muted-foreground">
            Configure um domínio próprio para enviar e-mails (ex.: <code>notify.seusite.com</code>). Necessário para
            e-mails transacionais e para responder tickets por e-mail.
          </p>
          <ol className="ml-5 list-decimal text-sm text-muted-foreground space-y-1">
            <li>Peça ao assistente Lovable: <em>"configurar domínio de e-mail"</em>.</li>
            <li>No diálogo, informe o subdomínio (ex.: <code>notify.seudominio.com</code>).</li>
            <li>Adicione os registros NS no seu provedor de DNS.</li>
            <li>Acompanhe o status em <strong>Cloud → Emails</strong> (até 72h para propagar).</li>
          </ol>
        </Card>





        <div>
          <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Salvar alterações</button>
        </div>
      </section>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary";

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">{icon}</span>
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs text-muted-foreground">{label}</label><div className="mt-1">{children}</div></div>;
}
function ReadOnly({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1 flex gap-2">
        <input readOnly value={value} className={inputCls + " font-mono text-xs"} />
        <button onClick={onCopy} className="rounded-md border border-border px-3 py-2 text-xs hover:bg-accent inline-flex items-center gap-1"><Copy className="h-3.5 w-3.5" /> Copiar</button>
      </div>
    </div>
  );
}
