import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminMetrics } from "@/lib/admin.functions";
import { MetricCard } from "@/components/metric-card";
import { Building2, Clock4, AlertTriangle, CheckCircle2, Pause, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_admin/")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "Admin · Dashboard — Fyn Sinc" }] }),
});

function AdminDashboard() {
  const fn = useServerFn(adminMetrics);
  const { data, isLoading } = useQuery({ queryKey: ["admin-metrics"], queryFn: () => fn() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Visão geral</h1>
        <p className="text-muted-foreground text-sm">Métricas globais do Fyn Sinc</p>
      </div>

      {isLoading || !data ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Organizações" value={String(data.totalOrgs)} icon={Building2} />
          <MetricCard label="Trials ativos" value={String(data.trialActive)} icon={Clock4} tone="primary" />
          <MetricCard label="Trials expirados" value={String(data.trialExpired)} icon={AlertTriangle} tone="destructive" />
          <MetricCard label="Empresas ativas" value={String(data.active)} icon={CheckCircle2} tone="success" />
          <MetricCard label="Suspensas" value={String(data.suspended)} icon={Pause} />
          <MetricCard label="Canceladas" value={String(data.canceled)} icon={AlertTriangle} />
          <MetricCard label="Usuários" value={String(data.totalUsers)} icon={Users} />
          <MetricCard label="Novas solicitações (7d)" value={String(data.newRequests7d)} icon={Sparkles} tone="primary" />
        </div>
      )}
    </div>
  );
}
