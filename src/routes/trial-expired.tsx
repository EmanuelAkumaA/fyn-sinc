import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, LogOut, Mail } from "lucide-react";
import { listMyOrganizations, type MyOrg } from "@/lib/org.functions";
import { getCurrentOrgIdLocal, clearCurrentOrgId } from "@/lib/current-org";

export const Route = createFileRoute("/trial-expired")({
  component: TrialExpiredPage,
});

function isBlocked(org: MyOrg): boolean {
  if (["expired", "suspended", "canceled"].includes(org.status)) return true;
  if (org.status === "trial" && org.trial_ends_at) {
    return new Date(org.trial_ends_at).getTime() < Date.now();
  }
  return false;
}

function TrialExpiredPage() {
  const navigate = useNavigate();
  const fetchOrgs = useServerFn(listMyOrganizations);
  const [org, setOrg] = useState<MyOrg | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        navigate({ to: "/login" });
        return;
      }
      try {
        const res = await fetchOrgs();
        if (!active) return;
        if (res.isSuperAdmin) {
          navigate({ to: "/admin" });
          return;
        }
        const currentId = getCurrentOrgIdLocal();
        const current = res.orgs.find((o) => o.id === currentId) ?? res.orgs[0] ?? null;
        if (!current || !isBlocked(current)) {
          navigate({ to: "/dashboard" });
          return;
        }
        setOrg(current);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchOrgs, navigate]);

  const handleSignOut = async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    clearCurrentOrgId();
    navigate({ to: "/login" });
  };

  if (loading || !org) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Verificando acesso...</div>;
  }

  const expiredOn = org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString("pt-BR") : null;
  const isTrial = org.status === "trial";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg border-destructive/30">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">
            {isTrial ? "Seu período de teste terminou" : "Acesso suspenso"}
          </CardTitle>
          <CardDescription>
            {isTrial
              ? `O trial de 15 dias da empresa ${org.name} expirou${expiredOn ? ` em ${expiredOn}` : ""}.`
              : `A empresa ${org.name} está com o status "${org.status}" e o acesso está bloqueado.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            Para reativar o acesso, fale com a equipe Fyn Sinc e escolha um plano que se ajuste à sua operação. Seus dados continuam preservados.
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild>
              <a href="mailto:contato@kumatech.com.br?subject=Reativar%20acesso%20Fyn%20Sinc">
                <Mail className="w-4 h-4 mr-2" /> Falar com a equipe
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/select-org">Trocar de empresa</Link>
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
