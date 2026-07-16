import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { useOrgId } from "@/hooks/use-org";
import { FileText, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/templates")({ component: TemplatesPage });

function TemplatesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", language: "pt_BR", category: "MARKETING", body: "", meta_template_name: "" });

  const { data } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => (await supabase.from("message_templates").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  async function save() {
    if (!form.name.trim() || !form.body.trim()) return toast.error("Nome e corpo obrigatórios");
    const variables = Array.from(form.body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)).map((m) => m[1]);
    const { error } = await supabase.from("message_templates").insert({ ...form, variables, status: "draft" });
    if (error) return toast.error(error.message);
    toast.success("Template salvo");
    setOpen(false); setForm({ name: "", language: "pt_BR", category: "MARKETING", body: "", meta_template_name: "" });
    qc.invalidateQueries({ queryKey: ["templates"] });
  }

  async function remove(id: string) {
    if (!confirm("Excluir template?")) return;
    await supabase.from("message_templates").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["templates"] });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">Modelos de mensagem para o WhatsApp (necessário para iniciar conversa fora da janela de 24h).</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Plus className="h-4 w-4" /> Novo template
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(data ?? []).map((t) => (
          <div key={t.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <div>
                  <h3 className="font-medium">{t.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{t.category} · {t.language} · <span className="uppercase">{t.status}</span></p>
                </div>
              </div>
              <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-md bg-background p-3 text-xs font-mono">{t.body}</pre>
            {t.variables?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {t.variables.map((v: string) => <span key={v} className="rounded-md bg-accent px-2 py-0.5 text-[10px]">{`{{${v}}}`}</span>)}
              </div>
            )}
          </div>
        ))}
        {data?.length === 0 && <div className="text-sm text-muted-foreground">Nenhum template ainda.</div>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Novo template</h2>
            <div className="space-y-3">
              <input placeholder="Nome interno" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="rounded-md border border-input bg-input/40 px-3 py-2 text-sm">
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utility</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </select>
                <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="rounded-md border border-input bg-input/40 px-3 py-2 text-sm">
                  <option value="pt_BR">Português (BR)</option>
                  <option value="en_US">English (US)</option>
                  <option value="es_LA">Español (LA)</option>
                </select>
              </div>
              <input placeholder="Nome na Meta (opcional)" value={form.meta_template_name} onChange={(e) => setForm({ ...form, meta_template_name: e.target.value })}
                className="w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm font-mono" />
              <textarea rows={5} placeholder="Corpo. Use {{nome}} para variáveis." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm" />
              <p className="text-[11px] text-muted-foreground">O envio real por template pela API oficial exige aprovação prévia na Meta Business Manager.</p>
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
