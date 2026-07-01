import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, MessageSquare, Zap, Users, ArrowRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/60 backdrop-blur sticky top-0 z-40 bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Bot className="h-5 w-5" />
            </div>
            <span className="font-semibold tracking-tight">NexaBot</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Entrar</Link>
            <Link to="/auth" className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              Começar <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_10%,oklch(0.30_0.08_190/0.35),transparent_60%),radial-gradient(circle_at_80%_40%,oklch(0.35_0.10_260/0.25),transparent_55%)]" />
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> IA + WhatsApp + Meta Lead Ads
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
            Transforme cada lead em conversa. <span className="text-primary">Automaticamente.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            NexaBot recebe seus leads do Meta Ads, responde no WhatsApp com IA, qualifica e dispara automações — em um painel só.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              Entrar no painel <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#recursos" className="rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:bg-accent">
              Ver recursos
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { i: MessageSquare, t: "WhatsApp Cloud API", d: "Envie e receba mensagens direto pelo painel, com histórico completo por contato." },
            { i: Bot, t: "IA que qualifica", d: "Gemini responde os leads em segundos, detecta intenção e aciona o fluxo certo." },
            { i: Users, t: "Meta Lead Ads", d: "Cada lead do formulário cai no funil, recebe boas-vindas e é distribuído automaticamente." },
            { i: Zap, t: "Automação de saída", d: "Webhook genérico plugável em Zapier, Make ou n8n para conectar seu CRM/ERP." },
            { i: CheckCircle2, t: "Funis simples", d: "Gatilhos + passos (mensagem, tag, wait, webhook) sem código." },
            { i: Users, t: "Multi-operador", d: "Papéis admin/operador com controle de permissões." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="rounded-xl border border-border bg-card p-6 transition hover:border-primary/40">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} NexaBot — Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
