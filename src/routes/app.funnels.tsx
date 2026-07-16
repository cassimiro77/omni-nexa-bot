import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Plus, GitBranch, Trash2, Power } from "lucide-react";
import { toast } from "sonner";
import { useOrgId } from "@/hooks/use-org";

export const Route = createFileRoute("/app/funnels")({ component: Funnels });

type Step = { type: "send_message" | "wait" | "add_tag" | "call_webhook"; content?: string; seconds?: number; tag?: string; url?: string };

function Funnels() {
  const qc = useQueryClient();
  const { data: orgId } = useOrgId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [trigger, setTrigger] = useState<"lead_ad_received" | "first_message" | "keyword">("lead_ad_received");
  const [keyword, setKeyword] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ type: "send_message", content: "Oi {{name}}!" }]);

  const { data } = useQuery({
    queryKey: ["funnels"],
    queryFn: async () => (await supabase.from("funnels").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  async function save() {
    if (!orgId) return toast.error("Workspace ainda carregando");
    if (!name.trim()) return toast.error("Nome obrigatório");
    const triggers = [trigger === "keyword" ? { type: "keyword", value: keyword } : { type: trigger }];
    const { error } = await supabase.from("funnels").insert({ org_id: orgId, name, description: desc, triggers, steps, active: true });
    if (error) return toast.error(error.message);
    toast.success("Funil criado");
    setOpen(false); setName(""); setDesc(""); setSteps([{ type: "send_message", content: "Oi {{name}}!" }]);
    qc.invalidateQueries({ queryKey: ["funnels"] });
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("funnels").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["funnels"] });
  }
  async function remove(id: string) {
    if (!confirm("Excluir funil?")) return;
    await supabase.from("funnels").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["funnels"] });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Funis</h1>
          <p className="text-sm text-muted-foreground">Automatize a jornada do lead.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Plus className="h-4 w-4" /> Novo funil
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((f) => (
          <div key={f.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">{f.name}</h3>
              </div>
              <div className="flex gap-1">
                <button onClick={() => toggle(f.id, f.active)} className={`rounded-md p-1.5 ${f.active ? "text-success" : "text-muted-foreground"}`}><Power className="h-4 w-4" /></button>
                <button onClick={() => remove(f.id)} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{f.description || "—"}</p>
            <div className="mt-4 text-xs text-muted-foreground">
              <div>Gatilhos: {(f.triggers as { type: string }[]).map((t) => t.type).join(", ")}</div>
              <div>Passos: {(f.steps as unknown[]).length}</div>
              <div className="mt-1">Status: <span className={f.active ? "text-success" : ""}>{f.active ? "ativo" : "pausado"}</span></div>
            </div>
          </div>
        ))}
        {data?.length === 0 && <div className="text-sm text-muted-foreground">Nenhum funil ainda.</div>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Novo funil</h2>
            <div className="space-y-3">
              <input placeholder="Nome do funil" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />
              <textarea placeholder="Descrição" value={desc} onChange={(e) => setDesc(e.target.value)}
                className="w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />
              <div>
                <label className="text-xs text-muted-foreground">Gatilho</label>
                <select value={trigger} onChange={(e) => setTrigger(e.target.value as typeof trigger)}
                  className="mt-1 w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm">
                  <option value="lead_ad_received">Lead do Meta Ads</option>
                  <option value="first_message">Primeira mensagem</option>
                  <option value="keyword">Palavra-chave</option>
                </select>
                {trigger === "keyword" && (
                  <input placeholder="palavra-chave" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                    className="mt-2 w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm" />
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Passos</label>
                <div className="space-y-2 mt-1">
                  {steps.map((s, i) => (
                    <div key={i} className="rounded-md border border-border bg-background p-3">
                      <div className="flex items-center justify-between mb-2">
                        <select value={s.type} onChange={(e) => {
                          const t = e.target.value as Step["type"];
                          const ns = [...steps]; ns[i] = { type: t }; setSteps(ns);
                        }} className="rounded-md border border-input bg-input/40 px-2 py-1 text-xs">
                          <option value="send_message">Enviar mensagem</option>
                          <option value="wait">Aguardar (s)</option>
                          <option value="add_tag">Adicionar tag</option>
                          <option value="call_webhook">Chamar webhook</option>
                        </select>
                        <button onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="text-xs text-destructive">remover</button>
                      </div>
                      {s.type === "send_message" && (
                        <input placeholder="Conteúdo (usa {{name}})" value={s.content ?? ""} onChange={(e) => { const ns = [...steps]; ns[i] = { ...s, content: e.target.value }; setSteps(ns); }}
                          className="w-full rounded-md border border-input bg-input/40 px-2 py-1 text-sm" />
                      )}
                      {s.type === "wait" && (
                        <input type="number" placeholder="segundos" value={s.seconds ?? 5} onChange={(e) => { const ns = [...steps]; ns[i] = { ...s, seconds: Number(e.target.value) }; setSteps(ns); }}
                          className="w-full rounded-md border border-input bg-input/40 px-2 py-1 text-sm" />
                      )}
                      {s.type === "add_tag" && (
                        <input placeholder="tag" value={s.tag ?? ""} onChange={(e) => { const ns = [...steps]; ns[i] = { ...s, tag: e.target.value }; setSteps(ns); }}
                          className="w-full rounded-md border border-input bg-input/40 px-2 py-1 text-sm" />
                      )}
                      {s.type === "call_webhook" && (
                        <input placeholder="https://..." value={s.url ?? ""} onChange={(e) => { const ns = [...steps]; ns[i] = { ...s, url: e.target.value }; setSteps(ns); }}
                          className="w-full rounded-md border border-input bg-input/40 px-2 py-1 text-sm" />
                      )}
                    </div>
                  ))}
                  <button onClick={() => setSteps([...steps, { type: "send_message", content: "" }])} className="text-xs text-primary">+ adicionar passo</button>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
              <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
