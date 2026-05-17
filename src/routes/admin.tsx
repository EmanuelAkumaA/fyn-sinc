import { createFileRoute, Outlet, Link, useRouterState, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signOutAndRedirect, isSessionExpired, clearSessionTimer } from "@/lib/session";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { LayoutDashboard, Building2, Users, Clock4, ShieldCheck, LogOut, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      window.location.assign("/login?next=/admin");
      throw redirect({ to: "/login" });
    }
    const { data: role } = await supabase
      .from("user_global_roles")
      .select("role")
      .eq("user_id", data.session.user.id)
      .maybeSingle();
    if (!role || role.role !== "super_admin") {
      window.sessionStorage.setItem(
        "fynsinc:flash",
        "Acesso restrito ao super admin. Você foi redirecionado para o app.",
      );
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/organizations", label: "Organizações", icon: Building2 },
  { to: "/admin/trials", label: "Trials", icon: Clock4 },
  { to: "/admin/users", label: "Usuários", icon: Users },
] as const;

function AdminLayout() {
  useSessionTimeout();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isSessionExpired()) {
      supabase.auth.signOut().finally(() => {
        clearSessionTimer();
        navigate({ to: "/login" });
      });
      return;
    }
    setReady(true);
  }, [navigate]);

  if (!ready) return null;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border bg-sidebar h-screen sticky top-0">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <div className="font-display font-bold leading-tight">Fyn Sinc</div>
            <div className="text-[11px] uppercase tracking-wider text-primary">Admin · Kuma Tech</div>
          </div>
        </div>
        <nav className="px-3 pt-2 space-y-1 overflow-y-auto flex-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = path === to || (to !== "/admin" && path.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition",
                  active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 space-y-1">
          <Link to="/dashboard" className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60">
            <ArrowLeft className="h-[18px] w-[18px]" />
            Ir para o App
          </Link>
          <button onClick={() => signOutAndRedirect(navigate, { reason: "manual" })} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60">
            <LogOut className="h-[18px] w-[18px]" />
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
