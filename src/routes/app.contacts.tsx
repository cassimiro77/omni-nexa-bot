import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/contacts")({ component: Contacts });

function Contacts() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", origin: "manual" });

  const { data } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => (await supabase.from("contacts").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = (data ?? []).filter((c) =>
    !q || [c.name, c.phone, c.email].some((v) => v?.toLowerCase().includes(q.toLowerCase()))
  );

  async function create() {
    if (!form.name && !form.phone) return toast.error("Nome ou telefone obrigatório");
    const { error } = await supabase.from("contacts").insert(form);
    if (error) return toast.error(error.message);
    toast.success("Lead criado");
    setOpen(false); setForm({ name: "", phone: "", email: "", origin: "manual" });
    qc.invalidateQueries({ queryKey: ["contacts"] });
  }

  async function remove(id: string) {
    if (!confirm("Excluir contato?")) return;
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["contacts"] });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contatos</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} leads</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo lead
        </button>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, telefone ou email"
        className="mb-4 w-full max-w-sm rounded-md border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Tags</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{c.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                <td className="px-4 py-3"><span className="rounded-md bg-accent px-2 py-0.5 text-xs">{c.origin}</span></td>
                <td className="px-4 py-3"><span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">{c.status}</span></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(c.tags ?? []).map((t) => <span key={t} className="rounded bg-accent/60 px-1.5 py-0.5 text-[10px]">{t}</span>)}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum contato.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Novo lead</h2>
            <div className="space-y-3">
              {(["name","phone","email","origin"] as const).map((f) => (
                <input key={f} placeholder={f} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                  className="w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
              <button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
