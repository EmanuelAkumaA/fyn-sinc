import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Wallet, Repeat, ArrowLeftRight,
  Package, Briefcase, Building2, Settings, LogOut,
} from "lucide-react";
import { signOutAndRedirect } from "@/lib/session";
import { cn } from "@/lib/utils";
import logoUrl from "@/assets/logo-full.svg";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/recorrencias", label: "Recorrências", icon: Repeat },
  { to: "/aportes", label: "Aportes/Repasses", icon: ArrowLeftRight },
  { to: "/planos", label: "Planos/Ferramentas", icon: Package },
  { to: "/servicos", label: "Serviços", icon: Briefcase },
  { to: "/bancos", label: "Bancos", icon: Building2 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();

  async function logout() {
    await signOutAndRedirect(navigate, { reason: "manual" });
  }

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border bg-sidebar h-screen sticky top-0">
      <div className="flex-1 flex flex-col justify-center min-h-0">
        <div className="px-5 pt-5 pb-1 flex items-center justify-center">
          <img src={logoUrl} alt="Fyn Sinc" className="h-32 object-contain" />
        </div>

        <nav className="px-3 pt-0 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition",
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
      </div>

      <button
        onClick={logout}
        className="m-3 flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
      >
        <LogOut className="h-[18px] w-[18px]" />
        Sair
      </button>
    </aside>
  );
}

export function MobileBottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const items = [
    { to: "/dashboard", label: "Início", icon: LayoutDashboard },
    { to: "/clientes", label: "Clientes", icon: Users },
    { to: "/financeiro", label: "Financeiro", icon: Wallet },
    { to: "/aportes", label: "Aportes", icon: ArrowLeftRight },
    { to: "/configuracoes", label: "Mais", icon: Settings },
  ] as const;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar/95 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => {
          const active = path === to || path.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
