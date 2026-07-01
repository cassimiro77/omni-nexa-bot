import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, MessageCircle, Users, GitBranch, Zap } from "lucide-react";

export const Route = createFileRoute("/app/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [contacts, messages, funnelRuns, events] = await Promise.all([
        supabase.from("contacts").select("id, status, origin, created_at, tags").gte("created_at", since),
        supabase.from("messages").select("id, direction, ai_used, created_at").gte("created_at", since),
        supabase.from("funnel_runs").select("id, status, created_at").gte("created_at", since),
        supabase.from("events").select("type, created_at").gte("created_at", since),
      ]);
      return {
        contacts: contacts.data ?? [],
        messages: messages.data ?? [],
        funnelRuns: funnelRuns.data ?? [],
        events: events.data ?? [],
      };
    },
  });

  const contacts = data?.contacts ?? [];
  const messages = data?.messages ?? [];
  const runs = data?.funnelRuns ?? [];

  const inbound = messages.filter((m) => m.direction === "inbound").length;
  const outbound = messages.filter((m) => m.direction === "outbound").length;
  const aiMsgs = messages.filter((m) => m.ai_used).length;
  const aiRate = outbound > 0 ? Math.round((aiMsgs / outbound) * 100) : 0;

  const byStatus = contacts.reduce<Record<string, number>>((acc, c) => { acc[c.status] = (acc[c.status] ?? 0) + 1; return acc; }, {});
  const byOrigin = contacts.reduce<Record<string, number>>((acc, c) => { acc[c.origin ?? "manual"] = (acc[c.origin ?? "manual"] ?? 0) + 1; return acc; }, {});

  const converted = (byStatus["converted"] ?? 0) + (byStatus["won"] ?? 0);
  const conversionRate = contacts.length > 0 ? Math.round((converted / contacts.length) * 100) : 0;

  const runsCompleted = runs.filter((r) => r.status === "completed").length;
  const runsRunning = runs.filter((r) => r.status === "running").length;
  const runsFailed = runs.filter((r) => r.status === "failed").length;

  // Daily activity — last 14 days
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i)); d.setHours(0, 0, 0, 0);
    return d;
  });
  const daily = days.map((d) => {
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const inRange = (iso: string) => { const t = new Date(iso).getTime(); return t >= d.getTime() && t < next.getTime(); };
    return {
      label: d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" }),
      contacts: contacts.filter((c) => inRange(c.created_at)).length,
      messages: messages.filter((m) => inRange(m.created_at)).length,
    };
  });
  const maxDaily = Math.max(1, ...daily.map((d) => Math.max(d.contacts, d.messages)));

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Métricas dos últimos 30 dias.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Metric icon={<Users className="h-4 w-4" />} label="Leads" value={contacts.length} accent="text-primary" />
        <Metric icon={<TrendingUp className="h-4 w-4" />} label="Taxa de conversão" value={`${conversionRate}%`} accent="text-success" />
        <Metric icon={<MessageCircle className="h-4 w-4" />} label="Mensagens" value={inbound + outbound} sub={`${inbound} in · ${outbound} out`} />
        <Metric icon={<Zap className="h-4 w-4" />} label="Respostas IA" value={`${aiRate}%`} sub={`${aiMsgs} de ${outbound}`} accent="text-primary" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card icon={<BarChart3 className="h-4 w-4" />} title="Atividade diária (14 dias)">
          <div className="flex items-end gap-1 h-40">
            {daily.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end h-32">
                  <div className="flex-1 rounded-t bg-primary/70" style={{ height: `${(d.contacts / maxDaily) * 100}%` }} title={`${d.contacts} leads`} />
                  <div className="flex-1 rounded-t bg-accent-foreground/50" style={{ height: `${(d.messages / maxDaily) * 100}%` }} title={`${d.messages} msgs`} />
                </div>
                <span className="text-[9px] text-muted-foreground rotate-45 origin-left translate-y-1">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary/70" /> Leads</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent-foreground/50" /> Mensagens</span>
          </div>
        </Card>

        <Card icon={<Users className="h-4 w-4" />} title="Leads por status">
          <Bars data={byStatus} />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card icon={<TrendingUp className="h-4 w-4" />} title="Origem dos leads">
          <Bars data={byOrigin} />
        </Card>
        <Card icon={<GitBranch className="h-4 w-4" />} title="Execuções de funil">
          <div className="grid grid-cols-3 gap-3 text-center">
            <MiniStat label="Rodando" value={runsRunning} accent="text-primary" />
            <MiniStat label="Concluídos" value={runsCompleted} accent="text-success" />
            <MiniStat label="Falhas" value={runsFailed} accent="text-destructive" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-muted-foreground text-xs">
        <span>{label}</span>
        <span className={accent ?? "text-primary"}>{icon}</span>
      </div>
      <div className={`mt-2 text-2xl font-semibold ${accent ?? ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Bars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Sem dados.</p>;
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k}>
          <div className="flex justify-between text-xs mb-1"><span className="capitalize">{k.replace(/_/g, " ")}</span><span className="text-muted-foreground">{v}</span></div>
          <div className="h-2 rounded-full bg-background overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-md bg-background p-3">
      <div className={`text-2xl font-semibold ${accent}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
