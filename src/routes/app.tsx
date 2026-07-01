import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Inbox, Users, GitBranch, Settings, LogOut, Bot, Plug, FileText, BarChart3, ShieldCheck } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/app")({ component: AppLayout });

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/inbox", label: "Inbox", icon: Inbox },
  { to: "/app/contacts", label: "Contatos", icon: Users },
  { to: "/app/funnels", label: "Funis", icon: GitBranch },
  { to: "/app/templates", label: "Templates", icon: FileText },
  { to: "/app/integrations", label: "Integrações", icon: Plug },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/admin", label: "Admin", icon: ShieldCheck },
  { to: "/app/settings", label: "Configurações", icon: Settings },
] as const;

function AppLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
      else setUser(data.session.user);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth" });
      else setUser(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (!checked || !user) {
    return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </div>
          <span className="font-semibold">NexaBot</span>
        </div>
        <nav className="p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <Link key={to} to={to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}>
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-60 border-t border-sidebar-border p-3">
          <div className="mb-2 px-2 text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
