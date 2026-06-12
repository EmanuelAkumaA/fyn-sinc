import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, PauseCircle, Pencil, Plus, Send, StopCircle, Trash2, Users } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge, EmptyState } from "@/components/ui-helpers";
import { ProviderForm, type ProviderRecord } from "@/components/provider-form";
import { AssignmentForm, type AssignmentRecord } from "@/components/assignment-form";
import {
  PROVIDER_TYPE_LABELS,
  PAYABLE_STATUS_LABELS,
  ASSIGNMENT_TYPE_LABELS,
  COMPENSATION_TYPE_LABELS,
  computeProviderCost,
  assignmentMonthlyCost,
  cancelPayable,
  launchPayableInFinance,
  fetchAssignmentExpectedRevenue,
  generateAssignmentSchedule,
  persistAssignmentSchedule,
  applyLaunchBehavior,
  addProviderPaymentPeriod,
  type PayableStatus,
} from "@/lib/providers";
import { formatBRL, formatDate, getCurrentOrgId } from "@/lib/fynsinc";
import { FREQUENCY_LABELS, type ExpenseFrequency } from "@/lib/expenses";
import { invalidateFinanceCaches } from "@/lib/finance";

export function ProviderDossier({
  providerId,
  open,
  onOpenChange,
}: {
  providerId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [assignmentSheet, setAssignmentSheet] = useState<{ open: boolean; initial: AssignmentRecord | null }>({ open: false, initial: null });
  const [notes, setNotes] = useState("");

  const provider = useQuery({
    queryKey: ["provider", providerId],
    enabled: !!providerId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("providers").select("*").eq("id", providerId!).single();
      if (error) throw error;
      setNotes(data.notes ?? "");
      return data;
    },
  });

  const assignments = useQuery({
    queryKey: ["provider-assignments", providerId],
    enabled: !!providerId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_assignments")
        .select("*, clients(id, name), services(id, name, default_value), recurring_contracts(id, description, amount)")
        .eq("provider_id", providerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const payables = useQuery({
    queryKey: ["provider-payables", providerId],
    enabled: !!providerId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_payables")
        .select("*, clients(id, name), services(id, name), banks(id, name)")
        .eq("provider_id", providerId!)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const metrics = useMemo(() => {
    const list = payables.data ?? [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let pending = 0, paid = 0, overdue = 0, paidThisMonth = 0;
    for (const p of list) {
      const amt = Number(p.amount ?? 0);
      if (p.status === "paga") {
        paid += amt;
        if (p.paid_at && new Date(p.paid_at) >= monthStart) paidThisMonth += amt;
      } else if (p.status === "cancelada") {
        // ignore
      } else {
        const due = p.due_date ? new Date(p.due_date) : null;
        if (due && due < now && p.status !== "paga") overdue += amt;
        else pending += amt;
      }
    }
    const recurring = (assignments.data ?? []).reduce(
      (sum: number, a: any) => sum + assignmentMonthlyCost(a),
      0,
    );
    return { pending, paid, overdue, paidThisMonth, recurring };
  }, [payables.data, assignments.data]);

  const saveProvider = useMutation({
    mutationFn: async (data: ProviderRecord) => {
      if (!providerId) return;
      const { error } = await supabase.from("providers").update(data).eq("id", providerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prestador atualizado");
      qc.invalidateQueries({ queryKey: ["provider", providerId] });
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["provider-summary"] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveAssignment = useMutation({
    mutationFn: async (data: AssignmentRecord) => {
      const org = await getCurrentOrgId();
      if (!org || !providerId) throw new Error("Organização não encontrada");
      const dbPayload = {
        provider_id: data.provider_id,
        client_id: data.client_id,
        service_id: data.service_id,
        client_recurring_contract_id: data.client_recurring_contract_id,
        assignment_type: data.assignment_type,
        compensation_type: data.compensation_type,
        fixed_amount: data.fixed_amount,
        percentage: data.percentage,
        frequency: data.frequency,
        start_date: data.start_date,
        end_date: data.end_date,
        first_due_date: data.first_due_date,
        installments_count: data.installments_count,
        recurrence_mode: data.recurrence_mode,
        auto_generate_payables: data.auto_generate_payables,
        launch_behavior: data.launch_behavior,
        status: data.status,
        notes: data.notes,
      };
      let assignmentId = assignmentSheet.initial?.id ?? null;
      if (assignmentId) {
        const { error } = await supabase.from("provider_assignments").update(dbPayload as any).eq("id", assignmentId);
        if (error) throw error;
      } else {
        const { data: ins, error } = await supabase
          .from("provider_assignments")
          .insert({ ...dbPayload, organization_id: org } as any)
          .select("id")
          .single();
        if (error) throw error;
        assignmentId = ins.id as string;
      }

      const revenue = await fetchAssignmentExpectedRevenue({
        recurring_contract_id: data.client_recurring_contract_id,
        service_id: data.service_id,
      });

      const [providerRow, clientRow, serviceRow] = await Promise.all([
        supabase.from("providers").select("name").eq("id", providerId).maybeSingle(),
        data.client_id ? supabase.from("clients").select("name").eq("id", data.client_id).maybeSingle() : Promise.resolve({ data: null } as any),
        data.service_id ? supabase.from("services").select("name").eq("id", data.service_id).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);

      const schedule = generateAssignmentSchedule({
        assignment_type: data.assignment_type,
        compensation_type: data.compensation_type,
        fixed_amount: data.fixed_amount,
        percentage: data.percentage,
        frequency: data.frequency,
        first_due_date: data.first_due_date,
        recurrence_mode: data.recurrence_mode,
        installments_count: data.installments_count,
        revenue,
        providerName: (providerRow as any).data?.name,
        clientName: (clientRow as any).data?.name ?? null,
        serviceName: (serviceRow as any).data?.name ?? null,
      });

      if (schedule.length > 0) {
        await persistAssignmentSchedule({
          organization_id: org,
          provider_id: providerId,
          assignment_id: assignmentId,
          client_id: data.client_id,
          service_id: data.service_id,
          schedule,
        });
        await applyLaunchBehavior({
          organization_id: org,
          provider_id: providerId,
          assignment_id: assignmentId,
          launch_behavior: data.launch_behavior,
        });
      }
      return assignmentId;
    },
    onSuccess: () => {
      toast.success(assignmentSheet.initial?.id ? "Vínculo atualizado" : "Vínculo criado");
      qc.invalidateQueries({ queryKey: ["provider-assignments", providerId] });
      qc.invalidateQueries({ queryKey: ["provider-payables", providerId] });
      qc.invalidateQueries({ queryKey: ["provider-summary"] });
      invalidateFinanceCaches(qc);
      qc.invalidateQueries({ queryKey: ["expense-occurrences"] });
      setAssignmentSheet({ open: false, initial: null });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const generatePayable = useMutation({
    mutationFn: async (a: any) => {
      const org = await getCurrentOrgId();
      if (!org || !providerId) throw new Error("Org/Prestador não encontrado");
      const revenue = await fetchAssignmentExpectedRevenue({
        recurring_contract_id: a.client_recurring_contract_id,
        service_id: a.service_id,
      });
      const cost = computeProviderCost(a.compensation_type, a.fixed_amount, a.percentage, revenue);
      if (cost <= 0) throw new Error("Custo zero — defina valor ou percentual e receita prevista");

      // Última parcela existente para esse vínculo.
      const list = (payables.data ?? []).filter((p: any) => p.provider_assignment_id === a.id);
      const last = list.reduce((acc: any, cur: any) => {
        if (!acc) return cur;
        return (cur.installment_number ?? 0) > (acc.installment_number ?? 0) ? cur : acc;
      }, null as any);
      const nextNumber = last ? (Number(last.installment_number ?? 0) + 1) : 1;
      const freq = (a.frequency as ExpenseFrequency) ?? "mensal";
      const baseDate = a.first_due_date ?? a.start_date;
      const due = addProviderPaymentPeriod(baseDate, freq, nextNumber - 1);

      const description = `Pagamento operacional — ${a.clients?.name ?? ""} — Parcela ${nextNumber}`.replace(/—  —/g, "—");

      const { error } = await supabase.from("provider_payables").insert({
        organization_id: org,
        provider_id: providerId,
        provider_assignment_id: a.id,
        client_id: a.client_id,
        service_id: a.service_id,
        amount: cost,
        due_date: due,
        reference_month: due.slice(0, 7) + "-01",
        description,
        installment_number: nextNumber,
        installments_total: a.installments_count ?? null,
        status: "nao_lancada",
      } as any);
      if (error) throw error;
      return { created: true };
    },
    onSuccess: () => {
      toast.success("Próxima obrigação gerada");
      qc.invalidateQueries({ queryKey: ["provider-payables", providerId] });
      qc.invalidateQueries({ queryKey: ["provider-summary"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateAssignmentStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AssignmentRecord["status"] }) => {
      const { error } = await supabase.from("provider_assignments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo atualizado");
      qc.invalidateQueries({ queryKey: ["provider-assignments", providerId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const launchPayable = useMutation({
    mutationFn: async (p: any) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Organização não encontrada");
      await launchPayableInFinance({
        id: p.id,
        organization_id: org,
        provider_id: p.provider_id,
        client_id: p.client_id,
        service_id: p.service_id,
        description: p.description,
        amount: Number(p.amount ?? 0),
        due_date: p.due_date,
        bank_id: p.bank_id,
        notes: p.notes,
        financial_transaction_id: p.financial_transaction_id,
      });
    },
    onSuccess: () => {
      toast.success("Lançado no Financeiro");
      invalidateFinanceCaches(qc);
      qc.invalidateQueries({ queryKey: ["provider-payables", providerId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelPayableMut = useMutation({
    mutationFn: async (p: any) => {
      await cancelPayable(p.id);
    },
    onSuccess: () => {
      toast.success("Obrigação cancelada");
      qc.invalidateQueries({ queryKey: ["provider-payables", providerId] });
      qc.invalidateQueries({ queryKey: ["provider-summary"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveNotes = useMutation({
    mutationFn: async () => {
      if (!providerId) return;
      const { error } = await supabase.from("providers").update({ notes }).eq("id", providerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Observações salvas");
      qc.invalidateQueries({ queryKey: ["provider", providerId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!provider.data) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader><SheetTitle>Carregando...</SheetTitle></SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const p = provider.data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <Users className="h-5 w-5 text-primary" /> {p.name}
            <StatusBadge status={p.status} />
            <span className="text-xs text-muted-foreground font-normal">
              {PROVIDER_TYPE_LABELS[p.provider_type as keyof typeof PROVIDER_TYPE_LABELS] ?? p.provider_type}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="ml-auto"><Pencil className="h-4 w-4" /></Button>
          </SheetTitle>
        </SheetHeader>

        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
          {p.document && <span>{p.document}</span>}
          {p.email && <span>{p.email}</span>}
          {p.phone && <span>{p.phone}</span>}
          {p.pix_key && <span>Pix: {p.pix_key}</span>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          <MetricCard label="Total pago" value={formatBRL(metrics.paid)} tone="success" />
          <MetricCard label="A pagar" value={formatBRL(metrics.pending)} tone="primary" />
          <MetricCard label="Em atraso" value={formatBRL(metrics.overdue)} tone="destructive" />
          <MetricCard label="Recorrente/mês" value={formatBRL(metrics.recurring)} />
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="w-full overflow-x-auto justify-start">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="links">Vínculos</TabsTrigger>
            <TabsTrigger value="payments">Pagamentos</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="notes">Observações</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3 mt-4">
            <Section title="Próximos pagamentos">
              {(payables.data ?? []).filter((x: any) => x.status !== "paga" && x.status !== "cancelada").slice(0, 5).map((pay: any) => (
                <PayableRow key={pay.id} pay={pay}
                  onLaunch={() => launchPayable.mutate(pay)}
                  onView={() => navigate({ to: "/financeiro" })}
                  onCancel={() => cancelPayableMut.mutate(pay)}
                />
              ))}
              {(payables.data ?? []).filter((x: any) => x.status !== "paga" && x.status !== "cancelada").length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma obrigação pendente.</p>
              )}
            </Section>
            <Section title="Clientes vinculados">
              <div className="flex flex-wrap gap-2">
                {Array.from(new Map((assignments.data ?? []).filter((a: any) => a.clients).map((a: any) => [a.clients.id, a.clients])).values()).map((c: any) => (
                  <span key={c.id} className="text-xs px-2 py-1 rounded-full bg-secondary/60">{c.name}</span>
                ))}
                {(assignments.data ?? []).filter((a: any) => a.clients).length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum cliente vinculado.</p>
                )}
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="links" className="space-y-3 mt-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setAssignmentSheet({ open: true, initial: null })} className="gap-2">
                <Plus className="h-4 w-4" /> Novo vínculo
              </Button>
            </div>
            {(assignments.data ?? []).length === 0 ? (
              <EmptyState icon={<Users className="h-5 w-5" />} title="Nenhum vínculo cadastrado para este prestador." />
            ) : (
              (assignments.data ?? []).map((a: any) => <AssignmentRow key={a.id} a={a}
                onEdit={() => setAssignmentSheet({ open: true, initial: { ...a, frequency: a.frequency ?? "mensal" } })}
                onPause={() => updateAssignmentStatus.mutate({ id: a.id, status: a.status === "pausado" ? "ativo" : "pausado" })}
                onEnd={() => updateAssignmentStatus.mutate({ id: a.id, status: "encerrado" })}
                onGenerate={() => generatePayable.mutate(a)}
              />)
            )}
          </TabsContent>

          <TabsContent value="payments" className="space-y-2 mt-4">
            {(payables.data ?? []).length === 0 ? (
              <EmptyState icon={<Send className="h-5 w-5" />} title="Nenhuma obrigação de pagamento encontrada." />
            ) : (
              (payables.data ?? []).map((pay: any) => (
                <PayableRow key={pay.id} pay={pay}
                  onLaunch={() => launchPayable.mutate(pay)}
                  onView={() => navigate({ to: "/financeiro" })}
                  onCancel={() => cancelPayableMut.mutate(pay)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="timeline" className="space-y-2 mt-4">
            <Timeline provider={p} assignments={assignments.data ?? []} payables={payables.data ?? []} />
          </TabsContent>

          <TabsContent value="notes" className="space-y-3 mt-4">
            <Label>Observações internas</Label>
            <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>Salvar observações</Button>
          </TabsContent>
        </Tabs>

        {/* Edit provider sheet */}
        <Sheet open={editing} onOpenChange={setEditing}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader><SheetTitle>Editar prestador</SheetTitle></SheetHeader>
            <ProviderForm initial={p as any} loading={saveProvider.isPending} onSubmit={(data) => saveProvider.mutate(data)} />
          </SheetContent>
        </Sheet>

        {/* Assignment sheet */}
        <Sheet open={assignmentSheet.open} onOpenChange={(v) => setAssignmentSheet({ open: v, initial: v ? assignmentSheet.initial : null })}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader><SheetTitle>{assignmentSheet.initial?.id ? "Editar vínculo" : "Novo vínculo"}</SheetTitle></SheetHeader>
            {providerId && (
              <AssignmentForm
                providerId={providerId}
                providerName={p.name}
                initial={assignmentSheet.initial}
                loading={saveAssignment.isPending}
                onSubmit={(data) => saveAssignment.mutate(data)}
              />
            )}
          </SheetContent>
        </Sheet>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <h4 className="font-medium text-sm mb-3">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function AssignmentRow({ a, onEdit, onPause, onEnd, onGenerate }: {
  a: any;
  onEdit: () => void;
  onPause: () => void;
  onEnd: () => void;
  onGenerate: () => void;
}) {
  return (
    <div className="glass rounded-2xl p-3 flex flex-col md:flex-row md:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="font-medium">{a.clients?.name ?? "Sem cliente"}</span>
          {a.services?.name && <><span>·</span><span>{a.services.name}</span></>}
          <StatusBadge status={a.status} />
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {ASSIGNMENT_TYPE_LABELS[a.assignment_type as "pontual" | "recorrente"]} · {COMPENSATION_TYPE_LABELS[a.compensation_type as "valor_fixo" | "porcentagem"]}
          {a.compensation_type === "valor_fixo" ? ` · ${formatBRL(a.fixed_amount)}` : ` · ${Number(a.percentage ?? 0).toFixed(1)}%`}
          {a.frequency && a.assignment_type === "recorrente" && ` · ${FREQUENCY_LABELS[a.frequency as ExpenseFrequency]}`}
          {a.recurrence_mode === "continuous" ? " · Contínuo" : a.installments_count ? ` · ${a.installments_count} lançamentos` : ""}
          {a.first_due_date && ` · 1º venc. ${formatDate(a.first_due_date)}`}
          {a.end_date && ` · último ${formatDate(a.end_date)}`}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" title="Editar" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
        {a.assignment_type === "recorrente" && a.status === "ativo" && (
          <Button size="icon" variant="ghost" title="Gerar próxima obrigação" onClick={onGenerate}><Plus className="h-4 w-4" /></Button>
        )}
        <Button size="icon" variant="ghost" title={a.status === "pausado" ? "Reativar" : "Pausar"} onClick={onPause}><PauseCircle className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" title="Encerrar" onClick={onEnd}><StopCircle className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function PayableRow({ pay, onLaunch, onView, onCancel }: { pay: any; onLaunch: () => void; onView: () => void; onCancel: () => void }) {
  const launched = !!pay.financial_transaction_id;
  const status = pay.status as PayableStatus;
  return (
    <div className="glass rounded-2xl p-3 flex flex-col md:flex-row md:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="font-medium truncate">{pay.description}</span>
          <StatusBadge status={status === "nao_lancada" ? "pendente" : status === "paga" ? "pago" : status === "vencida" ? "atrasado" : status === "cancelada" ? "cancelado" : "pendente"} />
          <span className="text-[10px] text-muted-foreground">{PAYABLE_STATUS_LABELS[status]}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
          {pay.clients?.name && <span>{pay.clients.name}</span>}
          {pay.services?.name && <><span>·</span><span>{pay.services.name}</span></>}
          <span>·</span><span>Vence {formatDate(pay.due_date)}</span>
          {pay.banks?.name && <><span>·</span><span>{pay.banks.name}</span></>}
        </div>
      </div>
      <div className="text-sm font-medium md:text-right whitespace-nowrap">{formatBRL(pay.amount)}</div>
      <div className="flex items-center gap-1">
        {launched ? (
          <Button size="icon" variant="ghost" title="Ver no Financeiro" onClick={onView}><ExternalLink className="h-4 w-4" /></Button>
        ) : status !== "cancelada" && status !== "paga" ? (
          <Button size="icon" variant="ghost" title="Lançar no Financeiro" onClick={onLaunch}><Send className="h-4 w-4" /></Button>
        ) : null}
        {status !== "paga" && status !== "cancelada" && (
          <Button size="icon" variant="ghost" title="Cancelar obrigação" onClick={onCancel}><Trash2 className="h-4 w-4" /></Button>
        )}
      </div>
    </div>
  );
}

function Timeline({ provider, assignments, payables }: { provider: any; assignments: any[]; payables: any[] }) {
  const events: { at: string; label: string }[] = [];
  events.push({ at: provider.created_at, label: "Prestador cadastrado" });
  for (const a of assignments) {
    events.push({ at: a.created_at, label: `Vínculo criado${a.clients?.name ? ` com ${a.clients.name}` : ""}` });
    if (a.status === "pausado") events.push({ at: a.updated_at, label: "Vínculo pausado" });
    if (a.status === "encerrado") events.push({ at: a.updated_at, label: "Vínculo encerrado" });
  }
  for (const p of payables) {
    events.push({ at: p.created_at, label: `Obrigação gerada — ${formatBRL(p.amount)}` });
    if (p.launched_at) events.push({ at: p.launched_at, label: "Lançada no Financeiro" });
    if (p.paid_at) events.push({ at: p.paid_at, label: `Pagamento realizado — ${formatBRL(p.amount)}` });
  }
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Sem eventos.</p>;
  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <div key={i} className="glass rounded-xl p-3 text-sm flex items-center justify-between gap-3">
          <span>{e.label}</span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(e.at)}</span>
        </div>
      ))}
    </div>
  );
}
