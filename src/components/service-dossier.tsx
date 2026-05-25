import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowDownCircle, ArrowUpCircle, Briefcase, CalendarClock,
  ExternalLink, Pencil, Plus, Receipt, Repeat, Users, Wallet, Zap, PauseCircle, PlayCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, EmptyState, FinancialStatusBadge } from "@/components/ui-helpers";
import { MetricCard } from "@/components/metric-card";
import { ClientLogo } from "@/components/client-logo";
import { formatBRL, formatDate, getCurrentOrgId, RECURRENCE_LABELS } from "@/lib/fynsinc";
import { invalidateFinanceCaches } from "@/lib/finance";
import { cn } from "@/lib/utils";

type Period = "today" | "week" | "month" | "year" | "custom" | "all";

function periodRange(p: Period, customFrom: string, customTo: string): { from: string | null; to: string | null } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (p === "today") return { from: fmt(now), to: fmt(now) };
  if (p === "week") {
    const start = new Date(now); start.setDate(now.getDate() - 6);
    return { from: fmt(start), to: fmt(now) };
  }
  if (p === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: fmt(start), to: fmt(end) };
  }
  if (p === "year") {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
  }
  if (p === "custom") return { from: customFrom || null, to: customTo || null };
  return { from: null, to: null };
}

const FREQ_FACTOR: Record<string, number> = {
  semanal: 4, quinzenal: 2, mensal: 1, bimestral: 0.5, trimestral: 1 / 3, semestral: 1 / 6, anual: 1 / 12,
};

export function ServiceDossier({
  serviceId, open, onOpenChange, onEdit,
}: {
  serviceId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit?: (service: any) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl lg:max-w-5xl overflow-y-auto p-0"
      >
        <SheetHeader className="sr-only"><SheetTitle>Dossiê do serviço</SheetTitle></SheetHeader>
        {serviceId && open && <DossierBody serviceId={serviceId} onEdit={onEdit} onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function DossierBody({ serviceId, onEdit, onClose }: { serviceId: string; onEdit?: (s: any) => void; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Service base
  const { data: service } = useQuery({
    queryKey: ["service", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("id", serviceId).single();
      if (error) throw error;
      return data;
    },
  });

  // Summary metrics (from view)
  const { data: summary } = useQuery({
    queryKey: ["service-summary", serviceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_service_summary").select("*").eq("service_id", serviceId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // All transactions for the service (unfiltered, for visão geral + financeiro)
  const { data: allTx = [] } = useQuery({
    queryKey: ["service-transactions", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .eq("service_id", serviceId)
        .order("due_date", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Recurring contracts for the service
  const { data: recurring = [] } = useQuery({
    queryKey: ["service-recurring", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_contracts")
        .select("*")
        .eq("service_id", serviceId)
        .order("next_due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Clients lookup
  const clientIds = useMemo(() => {
    const s = new Set<string>();
    allTx.forEach((t: any) => t.client_id && s.add(t.client_id));
    recurring.forEach((r: any) => r.client_id && s.add(r.client_id));
    return Array.from(s);
  }, [allTx, recurring]);

  const { data: clients = [] } = useQuery({
    queryKey: ["service-clients", serviceId, clientIds.join(",")],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url, brand_color, financial_status, client_status, full_name")
        .in("id", clientIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientById = useMemo(
    () => Object.fromEntries(clients.map((c: any) => [c.id, c])),
    [clients],
  );

  const range = periodRange(period, customFrom, customTo);
  const inRange = (d: string | null) => {
    if (!d) return false;
    if (range.from && d < range.from) return false;
    if (range.to && d > range.to) return false;
    return true;
  };

  // ------ Mutations: gerar transação, toggle status ------
  const toggleRecStatus = useMutation({
    mutationFn: async (r: any) => {
      const next = r.status === "ativo" ? "pausado" : "ativo";
      const { error } = await supabase.from("recurring_contracts").update({ status: next }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["service-recurring", serviceId] });
      qc.invalidateQueries({ queryKey: ["service-summary", serviceId] });
      qc.invalidateQueries({ queryKey: ["service-summary"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const generateNext = useMutation({
    mutationFn: async (r: any) => {
      if (r.status !== "ativo") throw new Error("Recorrência não está ativa");
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Sem organização");
      const amt = Number(r.amount);
      const { data: existing } = await supabase
        .from("financial_transactions")
        .select("id")
        .eq("recurring_contract_id", r.id)
        .eq("due_date", r.next_due_date);
      if (existing && existing.length > 0) throw new Error("Já existe transação para esta data");
      const { error } = await supabase.from("financial_transactions").insert({
        organization_id: org,
        type: "receita_propria" as const,
        status: "pendente" as const,
        description: r.description,
        category: "Recorrência",
        amount_gross: amt,
        amount_net: amt,
        due_date: r.next_due_date,
        client_id: r.client_id,
        service_id: r.service_id,
        bank_id: r.default_bank_id,
        recurring_contract_id: r.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mensalidade gerada no Financeiro");
      invalidateFinanceCaches(qc);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ------ Derivações ------
  const paidTx = allTx.filter((t: any) => t.status === "pago" && t.type === "receita_propria");
  const pendingTx = allTx.filter((t: any) => t.status === "pendente" && t.type === "receita_propria");
  const today = new Date().toISOString().slice(0, 10);
  const overdueTx = pendingTx.filter((t: any) => t.due_date && t.due_date < today);
  const upcomingTx = pendingTx.filter((t: any) => t.due_date && t.due_date >= today)
    .sort((a: any, b: any) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  const totalRevenue = Number(summary?.total_revenue ?? 0);
  const activeMrr = Number(summary?.active_mrr ?? 0);
  const avgTicket = Number(summary?.average_ticket ?? 0);
  const overdueAmount = Number(summary?.overdue_amount ?? 0);
  const activeClientsCount = Number(summary?.active_clients_count ?? 0);
  const totalClientsCount = Number(summary?.total_clients_count ?? 0);
  const inactiveClientsCount = Number(summary?.inactive_clients_count ?? 0);
  const pendingAvulsos = pendingTx.reduce((s: number, t: any) => s + Number(t.amount_gross ?? 0), 0);

  const isRecurring = service?.type === "recorrente";

  // ------ Clientes ativos x inativos ------
  const activeRecByClient = useMemo(() => {
    const m = new Map<string, any[]>();
    recurring.filter((r: any) => r.status === "ativo" && r.client_id).forEach((r: any) => {
      const list = m.get(r.client_id) ?? [];
      list.push(r);
      m.set(r.client_id, list);
    });
    return m;
  }, [recurring]);

  const allClientIds = useMemo(() => {
    const s = new Set<string>();
    allTx.forEach((t: any) => t.client_id && s.add(t.client_id));
    recurring.forEach((r: any) => r.client_id && s.add(r.client_id));
    return Array.from(s);
  }, [allTx, recurring]);

  const activeClientIds = useMemo(() => Array.from(activeRecByClient.keys()), [activeRecByClient]);
  const inactiveClientIds = useMemo(
    () => allClientIds.filter((id) => !activeRecByClient.has(id)),
    [allClientIds, activeRecByClient],
  );

  const lastPaidByClient = useMemo(() => {
    const m = new Map<string, any>();
    [...paidTx].sort((a: any, b: any) => (b.paid_at ?? b.due_date ?? "").localeCompare(a.paid_at ?? a.due_date ?? ""))
      .forEach((t: any) => {
        if (t.client_id && !m.has(t.client_id)) m.set(t.client_id, t);
      });
    return m;
  }, [paidTx]);

  const goNewTx = (clientId?: string) => {
    onClose();
    navigate({
      to: "/financeiro",
      search: { service_id: serviceId, new: "1", ...(clientId ? { client_id: clientId } : {}) } as any,
    });
  };
  const goNewRec = (clientId?: string) => {
    onClose();
    navigate({
      to: "/recorrencias",
      search: { service_id: serviceId, new: "1", ...(clientId ? { client_id: clientId } : {}) } as any,
    });
  };
  const goClient = (clientId: string) => {
    onClose();
    navigate({ to: "/clientes/$id", params: { id: clientId } });
  };

  if (!service) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-border/40 bg-card/50">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-primary/15 text-primary shrink-0">
            <Briefcase className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold truncate">{service.name}</h2>
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
              <span className="capitalize">{service.type}</span>
              {service.category && <><span>·</span><span>{service.category}</span></>}
              {service.default_value != null && <><span>·</span><span>{formatBRL(service.default_value)}</span></>}
              <StatusBadge status={service.status} />
            </div>
            {service.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{service.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => onEdit?.(service)} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button size="sm" onClick={() => goNewTx()} className="gap-1.5" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
              <Plus className="h-3.5 w-3.5" /> Lançamento
            </Button>
          </div>
        </div>

        {/* Filtro de período */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="space-y-1">
            <Label className="text-[11px]">Período</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mês atual</SelectItem>
                <SelectItem value="year">Ano</SelectItem>
                <SelectItem value="all">Todo histórico</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <>
              <div className="space-y-1">
                <Label className="text-[11px]">De</Label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Até</Label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
        <div className="overflow-x-auto border-b border-border/40">
          <TabsList className="m-2 inline-flex w-max bg-transparent">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="active">Clientes ativos</TabsTrigger>
            <TabsTrigger value="inactive">Clientes inativos</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="recurring">Recorrências</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Visão geral */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            {overdueAmount > 0 && (
              <div className="glass rounded-xl p-4 flex items-center gap-3 border-l-4 border-[color:var(--destructive)]">
                <AlertTriangle className="h-5 w-5 text-[color:var(--destructive)] shrink-0" />
                <div className="text-sm">
                  <div className="font-medium">Existem valores em atraso neste serviço.</div>
                  <div className="text-muted-foreground text-xs">Total em atraso: {formatBRL(overdueAmount)}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard label="Clientes ativos" value={String(activeClientsCount)} icon={Users} />
              <MetricCard label="Já compraram" value={String(totalClientsCount)} icon={Users} hint={`${inactiveClientsCount} inativos`} />
              <MetricCard label="Receita gerada" value={formatBRL(totalRevenue)} icon={Wallet} tone="success" />
              {isRecurring ? (
                <MetricCard label="MRR ativo" value={formatBRL(activeMrr)} icon={Repeat} tone="primary" />
              ) : (
                <MetricCard label="Avulsos pendentes" value={formatBRL(pendingAvulsos)} icon={CalendarClock} tone="primary" />
              )}
              <MetricCard label="Ticket médio" value={formatBRL(avgTicket)} icon={Receipt} />
              <MetricCard
                label="Inadimplência"
                value={formatBRL(overdueAmount)}
                icon={AlertTriangle}
                tone={overdueAmount > 0 ? "destructive" : "default"}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section title="Últimas vendas">
                {paidTx.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma venda paga vinculada a este serviço.</p>
                ) : (
                  <ul className="space-y-2">
                    {paidTx.slice(0, 5).map((t: any) => (
                      <TxRow key={t.id} t={t} client={clientById[t.client_id]} positive />
                    ))}
                  </ul>
                )}
              </Section>
              <Section title="Próximos vencimentos">
                {upcomingTx.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem lançamentos futuros pendentes.</p>
                ) : (
                  <ul className="space-y-2">
                    {upcomingTx.slice(0, 5).map((t: any) => (
                      <TxRow key={t.id} t={t} client={clientById[t.client_id]} />
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          </TabsContent>

          {/* Clientes ativos */}
          <TabsContent value="active" className="mt-0">
            {activeClientIds.length === 0 ? (
              <EmptyState icon={<Users className="h-6 w-6" />} title="Nenhum cliente ativo neste serviço." />
            ) : (
              <div className="space-y-2">
                {activeClientIds.map((cid) => {
                  const c = clientById[cid];
                  const recs = activeRecByClient.get(cid) ?? [];
                  const total = recs.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
                  const nextDue = recs.map((r: any) => r.next_due_date).filter(Boolean).sort()[0];
                  const lastPaid = lastPaidByClient.get(cid);
                  return (
                    <div key={cid} className="glass rounded-xl p-3 flex items-center gap-3">
                      <ClientLogo client={c} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{c?.name ?? "Cliente"}</span>
                          <FinancialStatusBadge value={c?.financial_status} />
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 mt-0.5">
                          <span>{formatBRL(total)} {recs[0]?.frequency ? `· ${RECURRENCE_LABELS[recs[0].frequency as keyof typeof RECURRENCE_LABELS] ?? recs[0].frequency}` : ""}</span>
                          {nextDue && <span>· Próx: {formatDate(nextDue)}</span>}
                          {lastPaid && <span>· Últ. pag: {formatDate(lastPaid.paid_at ?? lastPaid.due_date)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => goNewTx(cid)} title="Novo lançamento">
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => goClient(cid)} title="Abrir cliente">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Clientes inativos */}
          <TabsContent value="inactive" className="mt-0">
            {inactiveClientIds.length === 0 ? (
              <EmptyState icon={<Users className="h-6 w-6" />} title="Nenhum cliente inativo encontrado." />
            ) : (
              <div className="space-y-2">
                {inactiveClientIds.map((cid) => {
                  const c = clientById[cid];
                  const lastPaid = lastPaidByClient.get(cid);
                  const lastTx = allTx.filter((t: any) => t.client_id === cid)
                    .sort((a: any, b: any) => (b.due_date ?? "").localeCompare(a.due_date ?? ""))[0];
                  return (
                    <div key={cid} className="glass rounded-xl p-3 flex items-center gap-3">
                      <ClientLogo client={c} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{c?.name ?? "Cliente"}</span>
                          <FinancialStatusBadge value={c?.financial_status} />
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 mt-0.5">
                          {lastPaid && <span>Última compra: {formatDate(lastPaid.paid_at ?? lastPaid.due_date)} · {formatBRL(lastPaid.amount_gross)}</span>}
                          {!lastPaid && lastTx && <span>Última mov.: {formatDate(lastTx.due_date)}</span>}
                          <span>· Inativo no serviço</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => goNewTx(cid)} title="Nova cobrança">
                          <Plus className="h-4 w-4" />
                        </Button>
                        {isRecurring && (
                          <Button size="sm" variant="ghost" onClick={() => goNewRec(cid)} title="Nova recorrência">
                            <Repeat className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => goClient(cid)} title="Abrir cliente">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Financeiro */}
          <TabsContent value="financeiro" className="mt-0">
            <FinanceiroTab allTx={allTx} clientById={clientById} period={period} range={range} />
          </TabsContent>

          {/* Recorrências */}
          <TabsContent value="recurring" className="mt-0">
            {recurring.length === 0 ? (
              <EmptyState icon={<Repeat className="h-6 w-6" />} title="Nenhuma recorrência vinculada a este serviço." />
            ) : (
              <div className="space-y-2">
                {recurring.map((r: any) => {
                  const c = clientById[r.client_id];
                  return (
                    <div key={r.id} className="glass rounded-xl p-3 flex items-center gap-3 flex-wrap">
                      <ClientLogo client={c} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{c?.name ?? "Cliente"}</span>
                          <StatusBadge status={r.status} />
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 mt-0.5">
                          <span>{r.description}</span>
                          <span>· {formatBRL(r.amount)}</span>
                          <span>· {RECURRENCE_LABELS[r.frequency as keyof typeof RECURRENCE_LABELS] ?? r.frequency}</span>
                          <span>· Próx: {formatDate(r.next_due_date)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {r.status === "ativo" && (
                          <Button size="sm" variant="ghost" onClick={() => generateNext.mutate(r)} title="Gerar próxima" disabled={generateNext.isPending}>
                            <Zap className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => toggleRecStatus.mutate(r)} title={r.status === "ativo" ? "Pausar" : "Ativar"}>
                          {r.status === "ativo" ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => goClient(r.client_id)} title="Abrir cliente">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" onClick={() => goNewRec()} className="w-full gap-2 mt-2">
                  <Plus className="h-4 w-4" /> Nova recorrência neste serviço
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Timeline */}
          <TabsContent value="timeline" className="mt-0">
            <TimelineTab service={service} allTx={allTx} recurring={recurring} clientById={clientById} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-4">
      <h3 className="font-display font-semibold text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}

function TxRow({ t, client, positive }: { t: any; client?: any; positive?: boolean }) {
  const isPositive = positive ?? ["receita_propria", "comissao", "cashback"].includes(t.type);
  return (
    <li className="flex items-center gap-2 text-sm">
      {isPositive ? <ArrowUpCircle className="h-4 w-4 text-[color:var(--success)] shrink-0" />
        : <ArrowDownCircle className="h-4 w-4 text-[color:var(--destructive)] shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="truncate">{t.description}</div>
        <div className="text-[11px] text-muted-foreground">
          {client?.name ? `${client.name} · ` : ""}{formatDate(t.paid_at ?? t.due_date)}
        </div>
      </div>
      <span className={cn("font-medium text-sm", isPositive ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]")}>
        {formatBRL(t.amount_gross)}
      </span>
    </li>
  );
}

function FinanceiroTab({
  allTx, clientById, period, range,
}: {
  allTx: any[]; clientById: Record<string, any>; period: Period; range: { from: string | null; to: string | null };
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = allTx.filter((t: any) => {
    if (period !== "all") {
      if (range.from && (t.due_date ?? "") < range.from) return false;
      if (range.to && (t.due_date ?? "") > range.to) return false;
    }
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Tipo</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="receita_propria">Receita</SelectItem>
              <SelectItem value="comissao">Comissão</SelectItem>
              <SelectItem value="cashback">Cashback</SelectItem>
              <SelectItem value="taxa">Taxa</SelectItem>
              <SelectItem value="despesa_propria">Despesa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Wallet className="h-6 w-6" />} title="Nenhum lançamento vinculado a este serviço." />
      ) : (
        <div className="space-y-2">
          {filtered.map((t: any) => {
            const positive = ["receita_propria", "comissao", "cashback"].includes(t.type);
            const c = clientById[t.client_id];
            return (
              <div key={t.id} className="glass rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{t.description}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="capitalize">{t.type.replace("_", " ")}</span>
                    {c && <><span>·</span><span className="truncate max-w-[10rem]">{c.name}</span></>}
                    <span>·</span><span>{formatDate(t.due_date)}</span>
                  </div>
                </div>
                <StatusBadge status={t.status} />
                <span className={cn("font-semibold text-sm", positive ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]")}>
                  {formatBRL(t.amount_gross)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TimelineTab({
  service, allTx, recurring, clientById,
}: { service: any; allTx: any[]; recurring: any[]; clientById: Record<string, any> }) {
  type Ev = { date: string; icon: React.ReactNode; title: string; desc?: string; clientName?: string; amount?: number | null };
  const events: Ev[] = [];

  if (service.created_at) events.push({
    date: service.created_at, icon: <Briefcase className="h-4 w-4" />, title: "Serviço criado",
  });
  if (service.updated_at && service.updated_at !== service.created_at) events.push({
    date: service.updated_at, icon: <Pencil className="h-4 w-4" />, title: "Serviço atualizado",
  });

  allTx.forEach((t: any) => {
    const c = clientById[t.client_id];
    if (t.paid_at) events.push({
      date: t.paid_at, icon: <ArrowUpCircle className="h-4 w-4 text-[color:var(--success)]" />,
      title: "Pagamento recebido", desc: t.description, clientName: c?.name, amount: t.amount_gross,
    });
    if (t.created_at) events.push({
      date: t.created_at, icon: <Receipt className="h-4 w-4" />,
      title: "Lançamento criado", desc: t.description, clientName: c?.name, amount: t.amount_gross,
    });
  });
  recurring.forEach((r: any) => {
    const c = clientById[r.client_id];
    if (r.created_at) events.push({
      date: r.created_at, icon: <Repeat className="h-4 w-4 text-primary" />,
      title: "Recorrência criada", desc: r.description, clientName: c?.name, amount: r.amount,
    });
  });

  events.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  if (events.length === 0) {
    return <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="Nenhum evento encontrado para este serviço." />;
  }

  return (
    <ol className="space-y-3">
      {events.map((e, idx) => (
        <li key={idx} className="flex gap-3">
          <div className="h-8 w-8 shrink-0 rounded-full bg-secondary/50 flex items-center justify-center">{e.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{e.title}</div>
            <div className="text-xs text-muted-foreground">
              {e.desc && <span>{e.desc} · </span>}
              {e.clientName && <span>{e.clientName} · </span>}
              {e.amount != null && <span>{formatBRL(e.amount)} · </span>}
              <span>{formatDate(e.date)}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
