import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyOrganizations } from "@/lib/org.functions";
import { setCurrentOrgId } from "@/lib/current-org";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { signOutAndRedirect } from "@/lib/session";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/select-org")({
  component: SelectOrgPage,
  head: () => ({ meta: [{ title: "Selecionar empresa — Fyn Sinc" }] }),
});

function statusLabel(s: string) {
  return ({ trial: "Trial", active: "Ativa", suspended: "Suspensa", expired: "Expirada", canceled: "Cancelada" } as Record<string, string>)[s] ?? s;
}

function SelectOrgPage() {
  const navigate = useNavigate();
  const fetchOrgs = useServerFn(listMyOrganizations);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/login" });
      else setReady(true);
    });
  }, [navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["my-orgs"],
    queryFn: () => fetchOrgs(),
    enabled: ready,
  });

  function selectOrg(id: string, status: string) {
    if (["suspended", "canceled", "expired"].includes(status)) return;
    setCurrentOrgId(id);
    navigate({ to: "/dashboard" });
  }

  if (!ready || isLoading) {
    return <main className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</main>;
  }

  const orgs = data?.orgs ?? [];

  return (
    <main className="min-h-screen px-4 py-12 bg-background">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-3xl font-bold mb-2">Selecione a empresa</h1>
        <p className="text-muted-foreground mb-8">Você tem acesso a mais de uma organização. Escolha qual deseja acessar.</p>

        {data?.isSuperAdmin && (
          <button onClick={() => navigate({ to: "/admin" })} className="glass rounded-2xl p-5 w-full text-left mb-4 flex items-center gap-3 hover:bg-secondary/40 transition">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <div>
              <div className="font-semibold">Fyn Sinc Admin</div>
              <div className="text-sm text-muted-foreground">Painel interno da Kuma Tech</div>
            </div>
          </button>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {orgs.map((o) => {
            const blocked = ["suspended", "canceled", "expired"].includes(o.status);
            return (
              <button key={o.id} disabled={blocked} onClick={() => selectOrg(o.id, o.status)} className="glass rounded-2xl p-5 text-left disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary/40 transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-display text-lg font-semibold">{o.name}</div>
                  <Badge variant="outline">{statusLabel(o.status)}</Badge>
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Plano · {o.plan}</div>
                {o.status === "trial" && o.trial_ends_at && (
                  <div className="text-xs text-muted-foreground">
                    Trial até {new Date(o.trial_ends_at).toLocaleDateString("pt-BR")}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-2">Seu papel: {o.member_role}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={() => signOutAndRedirect(navigate, { reason: "manual" })}>Sair</Button>
        </div>
      </div>
    </main>
  );
}
