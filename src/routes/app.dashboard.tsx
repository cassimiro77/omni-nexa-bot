import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, MessageSquare, TrendingUp, Bot } from "lucide-react";

export const Route = createFileRoute("/app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      const [contacts, messages, aiMessages, qualified] = await Promise.all([
        supabase.from("contacts").select("*", { count: "exact", head: true }),
        supabase.from("messages").select("*", { count: "exact", head: true }),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("ai_used", true),
        supabase.from("contacts").select("*", { count: "exact", head: true }).eq("status", "qualified"),
      ]);
      return {
        contacts: contacts.count ?? 0,
        messages: messages.count ?? 0,
        aiMessages: aiMessages.count ?? 0,
        qualified: qualified.count ?? 0,
      };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["recent-contacts"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("*").order("last_message_at", { ascending: false, nullsFirst: false }).limit(5);
      return data ?? [];
    },
  });

  const cards = [
    { label: "Leads totais", value: data?.contacts ?? "—", icon: Users, hint: "no banco" },
    { label: "Mensagens", value: data?.messages ?? "—", icon: MessageSquare, hint: "trocadas" },
    { label: "Respostas IA", value: data?.aiMessages ?? "—", icon: Bot, hint: "geradas por IA" },
    { label: "Qualificados", value: data?.qualified ?? "—", icon: TrendingUp, hint: "prontos para venda" },
  ];

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu funil.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, hint }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Leads recentes</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody>
              {(recent ?? []).map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{c.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3"><span className="rounded-md bg-accent px-2 py-0.5 text-xs">{c.origin}</span></td>
                  <td className="px-4 py-3"><span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">{c.status}</span></td>
                </tr>
              ))}
              {(!recent || recent.length === 0) && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum lead ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
