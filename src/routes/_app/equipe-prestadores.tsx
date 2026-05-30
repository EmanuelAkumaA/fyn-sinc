import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Briefcase, Plus, Search, Users } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui-helpers";
import { MetricCard } from "@/components/metric-card";
import { ProviderForm, type ProviderRecord } from "@/components/provider-form";
import { ProviderDossier } from "@/components/provider-dossier";
import {
  PROVIDER_TYPE_LABELS,
  type ProviderType,
} from "@/lib/providers";
import { formatBRL, getCurrentOrgId } from "@/lib/fynsinc";

export const Route = createFileRoute("/_app/equipe-prestadores")({
  component: EquipePrestadoresPage,
  head: () => ({ meta: [{ title: "Equipe & Prestadores — Fyn Sinc" }] }),
});

function EquipePrestadoresPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [dossier, setDossier] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ["provider-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_provider_summary" as any).select("*");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const summaryById = useMemo(() => {
    const map: Record<string, any> = {};
    (summary.data ?? []).forEach((r: any) => { map[r.provider_id] = r; });
    return map;
  }, [summary.data]);

  const topMetrics = useMemo(() => {
    const list = summary.data ?? [];
    return {
      active: (providers.data ?? []).filter((p: any) => p.status === "ativo").length,
      recurring: list.reduce((s: number, r: any) => s + Number(r.recurring_monthly_cost ?? 0), 0),
      pending: list.reduce((s: number, r: any) => s + Number(r.pending_amount ?? 0), 0),
      overdue: list.reduce((s: number, r: any) => s + Number(r.overdue_amount ?? 0), 0),
      paidMonth: list.reduce((s: number, r: any) => s + Number(r.paid_amount_period ?? 0), 0),
      totalPaid: list.reduce((s: number, r: any) => s + Number(r.total_paid ?? 0), 0),
    };
  }, [summary.data, providers.data]);

  const filtered = (providers.data ?? []).filter((p: any) => {
    if (typeFilter !== "all" && p.provider_type !== typeFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (pendingOnly) {
      const s = summaryById[p.id];
      const hasPend = s && (Number(s.pending_amount ?? 0) > 0 || Number(s.overdue_amount ?? 0) > 0);
      if (!hasPend) return false;
    }
    if (search) {
      const t = search.toLowerCase();
      const hay = [p.name, p.document, p.phone, p.email].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(t)) return false;
    }
    return true;
  });

  const createProvider = useMutation({
    mutationFn: async (data: ProviderRecord) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Organização não encontrada");
      const { data: ins, error } = await supabase
        .from("providers")
        .insert({ ...data, organization_id: org })
        .select("id")
        .single();
      if (error) throw error;
      return ins.id as string;
    },
    onSuccess: (id) => {
      toast.success("Prestador criado");
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["provider-summary"] });
      setOpenForm(false);
      setDossier(id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Equipe & Prestadores"
        subtitle="Controle de profissionais, custos de execução e pagamentos."
        actions={
          <Button onClick={() => setOpenForm(true)} className="gap-2" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
            <Plus className="h-4 w-4" /> Novo prestador
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        <MetricCard label="Ativos" value={String(topMetrics.active)} icon={Users} />
        <MetricCard label="Recorrente/mês" value={formatBRL(topMetrics.recurring)} />
        <MetricCard label="Pendentes" value={formatBRL(topMetrics.pending)} tone="primary" />
        <MetricCard label="Em atraso" value={formatBRL(topMetrics.overdue)} tone="destructive" />
        <MetricCard label="Pagos no mês" value={formatBRL(topMetrics.paidMonth)} tone="success" />
        <MetricCard label="Total pago" value={formatBRL(topMetrics.totalPaid)} />
      </div>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, documento, telefone, e-mail..." className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="md:w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {(Object.keys(PROVIDER_TYPE_LABELS) as ProviderType[]).map((t) => (
              <SelectItem key={t} value={t}>{PROVIDER_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="md:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={pendingOnly ? "default" : "outline"} onClick={() => setPendingOnly((v) => !v)}>
          Com pendências
        </Button>
      </div>

      {providers.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title="Nenhum prestador cadastrado ainda."
          description="Cadastre freelancers, funcionários ou empresas terceirizadas para controlar custos de execução."
          action={
            <Button onClick={() => setOpenForm(true)} className="gap-2"><Plus className="h-4 w-4" /> Novo prestador</Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p: any) => {
            const s = summaryById[p.id] ?? {};
            return (
              <button
                key={p.id}
                onClick={() => setDossier(p.id)}
                className="glass rounded-2xl p-4 text-left hover:shadow-md transition-shadow flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {PROVIDER_TYPE_LABELS[p.provider_type as ProviderType] ?? p.provider_type}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Mini label="Recorrente" value={formatBRL(s.recurring_monthly_cost)} />
                  <Mini label="Pendente" value={formatBRL(s.pending_amount)} />
                  <Mini label="Atraso" value={formatBRL(s.overdue_amount)} tone={Number(s.overdue_amount ?? 0) > 0 ? "destructive" : undefined} />
                  <Mini label="Pago no mês" value={formatBRL(s.paid_amount_period)} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {Number(s.linked_clients_count ?? 0)} cliente(s) · {Number(s.linked_services_count ?? 0)} serviço(s)
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={openForm} onOpenChange={setOpenForm}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Novo prestador</SheetTitle></SheetHeader>
          <ProviderForm initial={null} loading={createProvider.isPending} onSubmit={(data) => createProvider.mutate(data)} />
        </SheetContent>
      </Sheet>

      <ProviderDossier providerId={dossier} open={!!dossier} onOpenChange={(v) => { if (!v) setDossier(null); }} />
    </>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "destructive" }) {
  const cls = tone === "destructive" ? "text-[color:var(--destructive)]" : "text-foreground";
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`font-medium ${cls}`}>{value}</div>
    </div>
  );
}
