import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendTestWhatsApp } from "@/lib/wa-test.functions";
import { toast } from "sonner";
import { Send, MessageSquare, FileCode } from "lucide-react";

export const Route = createFileRoute("/app/admin-test")({ component: AdminTestPage });

function AdminTestPage() {
  const send = useServerFn(sendTestWhatsApp);

  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"freeform" | "template">("freeform");
  const [message, setMessage] = useState("Olá! Esta é uma mensagem de teste do NexaBot.");
  const [templateName, setTemplateName] = useState("hello_world");
  const [languageCode, setLanguageCode] = useState("en_US");
  const [sending, setSending] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!isAdmin) {
    return <div className="p-8 text-sm text-muted-foreground">Acesso restrito a administradores.</div>;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return toast.error("Preencha nome e telefone.");
    setSending(true);
    try {
      // Garante uma sessão válida antes de chamar o server fn (evita "Authentication Error")
      let { data: sess } = await supabase.auth.getSession();
      const expiresAt = sess.session?.expires_at ? sess.session.expires_at * 1000 : 0;
      const shouldRefresh = !sess.session || (expiresAt > 0 && expiresAt - Date.now() < 60_000);
      if (shouldRefresh) {
        const refreshed = await supabase.auth.refreshSession();
        sess = { session: refreshed.data.session } as typeof sess;
      }
      if (!sess.session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente para enviar.");
        return;
      }

      const accessToken = sess.session.access_token;
      const res = await send({
        data: {
          accessToken,
          name: name.trim(),
          phone: phone.trim(),
          mode,
          message: mode === "freeform" ? message : undefined,
          templateName: mode === "template" ? templateName : undefined,
          languageCode: mode === "template" ? languageCode : undefined,
        },
      });
      toast.success(`Enviado! WA id: ${res.waMessageId ?? "-"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no envio.";
      console.error("[admin-test] erro no envio:", err);
      if (/unauthorized|authentication|no authorization/i.test(msg)) {
        toast.error("Sessão expirada. Faça login novamente e tente de novo.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Teste de Envio</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre rapidamente um contato e dispare uma mensagem de teste via WhatsApp para qualquer número.
        </p>
      </header>

      <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome do cliente</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Maria Silva"
              maxLength={100}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Telefone (com DDI)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="5511999999999"
              maxLength={20}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Formato E.164, apenas dígitos. Ex.: 5511999999999.</p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Tipo de mensagem</label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("freeform")}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                mode === "freeform" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent/40"
              }`}
            >
              <MessageSquare className="h-4 w-4" /> Mensagem livre (janela de 24h)
            </button>
            <button
              type="button"
              onClick={() => setMode("template")}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                mode === "template" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent/40"
              }`}
            >
              <FileCode className="h-4 w-4" /> Template aprovado
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {mode === "freeform"
              ? "Mensagem livre só entrega se o contato interagiu com o bot nas últimas 24h."
              : "Templates funcionam para qualquer número. Padrão Meta: hello_world (en_US)."}
          </p>
        </div>

        {mode === "freeform" ? (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1000}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome do template</label>
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="hello_world"
                maxLength={80}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Idioma</label>
              <input
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="en_US"
                maxLength={10}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {sending ? "Enviando…" : "Enviar teste"}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-2">Sobre o envio</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>O contato é criado automaticamente no CRM com origem <code>admin_test</code>.</li>
          <li>Envios ficam registrados no Inbox e nas mensagens do contato.</li>
          <li>E-mail entra na próxima fase (após configurar domínio de e-mail).</li>
        </ul>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <p className="font-medium mb-2">Widget de chat para outros sites</p>
        <p className="text-sm text-muted-foreground mb-3">
          Copie o snippet e cole antes de <code>&lt;/body&gt;</code> no site correspondente. Conversas chegam no
          Inbox com a origem indicada.
        </p>
        <WidgetSnippets />
      </div>
    </div>
  );
}

function WidgetSnippets() {
  const base = typeof window !== "undefined" ? window.location.origin : "https://omni-nexa-bot.lovable.app";
  const sites: { source: string; label: string; title: string; color: string }[] = [
    { source: "nexalytix", label: "Nexalytix", title: "Nexalytix — Fale com a gente", color: "#2563eb" },
    { source: "bolo-memoria", label: "Bolo & Memória", title: "Bolo & Memória — Pedidos", color: "#db2777" },
  ];
  return (
    <div className="space-y-4">
      {sites.map((s) => {
        const snippet = `<script src="${base}/api/public/widget/embed.js" data-source="${s.source}" data-title="${s.title}" data-color="${s.color}" defer></script>`;
        return (
          <div key={s.source} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{s.label}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(snippet);
                  toast.success(`Snippet ${s.label} copiado`);
                }}
                className="text-xs rounded-md border border-border px-2 py-1 hover:bg-accent/40"
              >
                Copiar
              </button>
            </div>
            <pre className="text-[11px] leading-relaxed overflow-x-auto text-muted-foreground">{snippet}</pre>
          </div>
        );
      })}
    </div>
  );
}

