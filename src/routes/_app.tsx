import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar, MobileBottomNav } from "@/components/app-sidebar";
import { clearSessionTimer, isSessionExpired } from "@/lib/session";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { listMyOrganizations, type MyOrg } from "@/lib/org.functions";
import { getCurrentOrgIdLocal } from "@/lib/current-org";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function isOrgBlocked(org: MyOrg): boolean {
  if (["expired", "suspended", "canceled"].includes(org.status)) return true;
  if (org.status === "trial" && org.trial_ends_at) {
    return new Date(org.trial_ends_at).getTime() < Date.now();
  }
  return false;
}

function AppLayout() {
  useSessionTimeout();
  const navigate = useNavigate();
  const fetchOrgs = useServerFn(listMyOrganizations);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const flash = window.sessionStorage.getItem("fynsinc:flash");
      if (flash) {
        window.sessionStorage.removeItem("fynsinc:flash");
        toast.error(flash);
      }
    }
    let active = true;

    const evaluate = async () => {
      if (isSessionExpired()) {
        try { await supabase.auth.signOut(); } catch { /* ignore */ }
        clearSessionTimer();
        if (active) navigate({ to: "/login" });
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        navigate({ to: "/login" });
        return;
      }

      // Trial / status gating
      try {
        const res = await fetchOrgs();
        if (!active) return;
        if (!res.isSuperAdmin) {
          const currentId = getCurrentOrgIdLocal();
          const current = res.orgs.find((o) => o.id === currentId) ?? res.orgs[0];
          if (current && isOrgBlocked(current)) {
            navigate({ to: "/trial-expired" });
            return;
          }
        }
      } catch { /* ignore – allow app to render */ }

      setReady(true);
    };

    evaluate();

    // Só desloga em SIGNED_OUT explícito. INITIAL_SESSION/TOKEN_REFRESHED
    // podem chegar com session=null momentaneamente durante a hidratação,
    // o que causava redirecionamento indevido para /login logo após o login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        if (active) navigate({ to: "/login" });
        return;
      }
      if (session && (event === "TOKEN_REFRESHED" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        if (active) setReady(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate, fetchOrgs]);

  if (!ready) return null;

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0 pb-24 md:pb-8">
        <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
