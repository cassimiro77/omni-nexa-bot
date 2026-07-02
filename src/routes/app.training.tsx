import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, FileUp, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getBotTraining, saveBotTraining } from "@/lib/bot-settings.functions";

export const Route = createFileRoute("/app/training")({ component: TrainingPage });

function TrainingPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const loadTraining = useServerFn(getBotTraining);
  const saveTraining = useServerFn(saveBotTraining);
  const [form, setForm] = useState({ businessName: "", welcomeMessage: "", botScript: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["bot-training"],
    queryFn: () => loadTraining(),
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      businessName: data.businessName,
      welcomeMessage: data.welcomeMessage,
      botScript: data.botScript,
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => saveTraining({ data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bot-training"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Treinamento salvo");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro ao salvar"),
  });

  async function importFile(file: File) {
    if (!/\.(txt|md)$/i.test(file.name)) {
      toast.error("Importe um arquivo .txt ou .md");
      return;
    }
    if (file.size > 120_000) {
      toast.error("Arquivo muito grande. Use até 120 KB.");
      return;
    }
    const text = (await file.text()).trim();
    if (text.length < 20) {
      toast.error("O roteiro precisa ter pelo menos 20 caracteres");
      return;
    }
    setForm((current) => ({ ...current, botScript: text.slice(0, 8000) }));
    toast.success("Roteiro importado");
  }

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Treinamento do bot</h1>
          <p className="text-sm text-muted-foreground">Defina o roteiro que a IA usa para responder no WhatsApp e no Inbox.</p>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || isLoading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> Salvar
        </button>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary"><Bot className="h-4 w-4" /></span>
            Script principal
          </div>
          <div className="space-y-4">
            <Field label="Nome do negócio">
              <input
                value={form.businessName}
                maxLength={120}
                onChange={(event) => setForm({ ...form, businessName: event.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Mensagem de boas-vindas">
              <textarea
                value={form.welcomeMessage}
                maxLength={600}
                rows={3}
                onChange={(event) => setForm({ ...form, welcomeMessage: event.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Roteiro, regras e treinamento">
              <textarea
                value={form.botScript}
                maxLength={8000}
                rows={18}
                onChange={(event) => setForm({ ...form, botScript: event.target.value })}
                placeholder="Ex.: Você é um consultor comercial. Cumprimente, qualifique o lead, entenda a necessidade, apresente benefícios, peça dados para agendamento e responda de forma curta..."
                className={inputCls + " leading-relaxed"}
              />
            </Field>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{form.botScript.length}/8000 caracteres</span>
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-accent">
                <FileUp className="h-4 w-4" /> Importar .txt/.md
              </button>
              <input ref={fileRef} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
                event.currentTarget.value = "";
              }} />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> Base recomendada</div>
            <button
              onClick={() => setForm((current) => ({ ...current, botScript: starterScript(current.businessName || "NexaBot") }))}
              className="mb-3 w-full rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              Usar modelo comercial
            </button>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>• Tom de voz e objetivo da conversa.</li>
              <li>• Perguntas de qualificação.</li>
              <li>• Objeções comuns e respostas.</li>
              <li>• Quando pedir atendimento humano.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 text-xs text-muted-foreground">
            O botão “Sugerir com IA” e a resposta automática do WhatsApp usam este roteiro salvo.
          </div>
        </aside>
      </section>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs text-muted-foreground">{label}</label><div className="mt-1">{children}</div></div>;
}

function starterScript(name: string) {
  return `Você é o assistente comercial da ${name}.

Objetivo: responder leads do WhatsApp com mensagens curtas, educadas e objetivas, conduzindo para qualificação e agendamento.

Fluxo:
1. Cumprimente pelo nome quando disponível.
2. Entenda o que o lead procura e qual problema quer resolver.
3. Faça no máximo uma pergunta por mensagem.
4. Se houver interesse, peça melhor horário para atendimento ou demonstração.
5. Se o lead pedir preço, explique que depende do escopo e colete contexto antes.
6. Se não souber responder, diga que vai chamar um especialista humano.

Tom: profissional, direto, consultivo e em português do Brasil.

Nunca invente informações técnicas, preços, prazos ou promessas comerciais.`;
}
