import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/app/admin")({ component: AdminPage });

function AdminPage() {
  const qc = useQueryClient();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin === true,
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      const { data: roles } = await supabase.from("user_roles").select("*");
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      }));
    },
  });

  async function setRole(userId: string, newRole: "admin" | "operator", currentRoles: string[]) {
    // remove current, insert new
    const toRemove = currentRoles.filter((r) => r !== newRole);
    for (const r of toRemove) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", r as "admin" | "operator");
    }
    if (!currentRoles.includes(newRole)) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (error) return toast.error(error.message);
    }
    toast.success("Papel atualizado");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  if (isAdmin === false) {
    return <div className="p-8"><p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p></div>;
  }

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="text-sm text-muted-foreground">Gerencie operadores e administradores.</p>
      </header>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Usuário</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Papel</th>
              <th className="text-left px-4 py-3">Cadastro</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3 flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
                    {u.roles.includes("admin") ? <ShieldCheck className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                  </div>
                  {u.full_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.roles.includes("admin") ? "admin" : "operator"}
                    onChange={(e) => setRole(u.id, e.target.value as "admin" | "operator", u.roles)}
                    className="rounded-md border border-input bg-input/40 px-2 py-1 text-xs"
                  >
                    <option value="operator">Operador</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                <td></td>
              </tr>
            ))}
            {users?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Sem usuários.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Para adicionar um operador, peça que ele se cadastre em <code>/auth</code>. Ele entra como operador por padrão; você pode promovê-lo a admin aqui.
      </p>
    </div>
  );
}
