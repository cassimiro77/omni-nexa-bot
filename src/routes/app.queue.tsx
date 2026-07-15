import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { takeOverContact } from "@/lib/handoff.functions";
import { toast } from "sonner";
import { Users, Clock, ArrowRight, UserCheck, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/app/queue")({ component: QueuePage });

type Row = {
  id: string;
  contact_id: string;
  status: "waiting" | "in_service" | "resolved" | "abandoned";
  requested_at: string;
  assigned_at: string | null;
  assigned_to: string | null;
  escalated_at: string | null;
  customer_notified_at: string | null;
  contacts: { name: string | null; phone: string | null; origin: string | null } | null;
};

function QueuePage() {
  const qc = useQueryClient();
  const takeOver = useServerFn(takeOverContact);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: rows } = useQuery({
    queryKey: ["handoff-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("handoff_queue")
        .select("id, contact_id, status, requested_at, assigned_at, assigned_to, escalated_at, customer_notified_at, contacts(name, phone, origin)")
        .in("status", ["waiting", "in_service"])
        .order("requested_at", { ascending: true });
      return (data ?? []) as unknown as Row[];
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("queue-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "handoff_queue" }, () => {
        qc.invalidateQueries({ queryKey: ["handoff-queue"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const waiting = (rows ?? []).filter((r) => r.status === "waiting");
  const inService = (rows ?? []).filter((r) => r.status === "in_service");

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Fila de Atendimento</h1>
          <p className="text-sm text-muted-foreground">Solicitações de atendimento humano com cronômetro ao vivo.</p>
        </div>
      </header>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Aguardando ({waiting.length})</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Contato</th>
                <th className="px-4 py-2 text-left">Telefone</th>
                <th className="px-4 py-2 text-left">Aguardando</th>
                <th className="px-4 py-2 text-left">Sinais</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((r) => {
                const elapsed = Math.floor((Date.now() - new Date(r.requested_at).getTime()) / 1000);
                const color = elapsed < 30 * 60 ? "text-emerald-500" : elapsed < 70 * 60 ? "text-amber-500" : "text-red-500";
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{r.contacts?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.contacts?.phone ?? "—"}</td>
                    <td className={`px-4 py-2 font-mono ${color}`}><Clock className="inline h-3 w-3 mr-1" /> {fmt(elapsed)}</td>
                    <td className="px-4 py-2 text-xs space-x-2">
                      {r.customer_notified_at && <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5">cliente avisado</span>}
                      {r.escalated_at && <span className="rounded bg-red-500/10 text-red-500 px-1.5 py-0.5 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> escalado</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={async () => {
                          try {
                            await takeOver({ data: { contactId: r.contact_id } });
                            qc.invalidateQueries({ queryKey: ["handoff-queue"] });
                            toast.success("Atendimento assumido");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Erro");
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                      ><UserCheck className="h-3 w-3" /> Assumir</button>
                      <Link
                        to="/app/inbox"
                        className="ml-2 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90"
                      >Abrir <ArrowRight className="h-3 w-3" /></Link>
                    </td>
                  </tr>
                );
              })}
              {waiting.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nenhum atendimento aguardando.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Em atendimento ({inService.length})</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Contato</th>
                <th className="px-4 py-2 text-left">Telefone</th>
                <th className="px-4 py-2 text-left">Em atendimento há</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {inService.map((r) => {
                const base = r.assigned_at ?? r.requested_at;
                const elapsed = Math.floor((Date.now() - new Date(base).getTime()) / 1000);
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{r.contacts?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.contacts?.phone ?? "—"}</td>
                    <td className="px-4 py-2 font-mono"><Clock className="inline h-3 w-3 mr-1" /> {fmt(elapsed)}</td>
                    <td className="px-4 py-2 text-right">
                      <Link to="/app/inbox" className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90">Abrir <ArrowRight className="h-3 w-3" /></Link>
                    </td>
                  </tr>
                );
              })}
              {inService.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Nenhum atendimento em andamento.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <div className="hidden">{tick}</div>
    </div>
  );
}

function fmt(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}
