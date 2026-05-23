import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Repeat, Play, Pause, Pencil, Trash2, Zap, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui-helpers";
import { MetricCard } from "@/components/metric-card";
import { formatBRL, formatDate, getCurrentOrgId, nextAnchoredDate, RECURRENCE_LABELS, type RecurrenceFreq } from "@/lib/fynsinc";

export const Route = createFileRoute("/_app/recorrencias")({
  component: RecorrenciasPage,
  head: () => ({ meta: [{ title: "Recorrências — Fyn Sinc" }] }),
});

const FREQS: RecurrenceFreq[] = ["semanal", "quinzenal", "mensal", "trimestral", "semestral", "anual"];
const STATUSES = ["ativo", "pausado", "cancelado", "inativo"] as const;

function RecorrenciasPage() {
  const qc = useQueryClient();
  const [openSheet, setOpenSheet] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [freqFilter, setFreqFilter] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["recorrencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_contracts")
        .select("*")
        .order("next_due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });
  const { data: banks = [] } = useQuery({
    queryKey: ["banks-min"],
    queryFn: async () => (await supabase.from("banks").select("id, name").order("name")).data ?? [],
  });
  const { data: services = [] } = useQuery({
    queryKey: ["services-min"],
    queryFn: async () => (await supabase.from("services").select("id, name").order("name")).data ?? [],
  });

  const clientById = useMemo(() => Object.fromEntries(clients.map((c: any) => [c.id, c])), [clients]);

  const filtered = rows.filter((r: any) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (freqFilter !== "all" && r.frequency !== freqFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const cli = clientById[r.client_id]?.name?.toLowerCase() ?? "";
      if (!r.description?.toLowerCase().includes(s) && !cli.includes(s)) return false;
    }
    return true;
  });

  const activeRows = rows.filter((r: any) => r.status === "ativo");
  const totalMonthly = activeRows.reduce((sum: number, r: any) => {
    const amt = Number(r.amount ?? 0);
    const m: Record<string, number> = { semanal: 4, quinzenal: 2, mensal: 1, trimestral: 1 / 3, semestral: 1 / 6, anual: 1 / 12 };
    return sum + amt * (m[r.frequency] ?? 1);
  }, 0);
  const nextDue = activeRows[0]?.next_due_date;

  const save = useMutation({
    mutationFn: async (p: any) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Sem organização");
      const anchor = Number(p.start_date.slice(8, 10));
      const installmentsTotal = p.installments_total ? Number(p.installments_total) : null;
      const basePayload: any = {
        client_id: p.client_id,
        service_id: p.service_id || null,
        description: p.description,
        amount: Number(p.amount),
        frequency: p.frequency,
        start_date: p.start_date,
        default_bank_id: p.default_bank_id || null,
        notes: p.notes || null,
        status: p.status,
        anchor_day: anchor,
        installments_total: installmentsTotal,
      };
      if (editing?.id) {
        // Se a data inicial mudou e ainda não há parcelas geradas, recalcula next_due_date
        const update: any = { ...basePayload };
        if ((editing.installments_generated ?? 0) === 0) {
          update.next_due_date = p.start_date;
        }
        const { error } = await supabase.from("recurring_contracts").update(update).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recurring_contracts").insert({
          ...basePayload,
          next_due_date: p.start_date,
          installments_generated: 0,
          organization_id: org,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Recorrência atualizada" : "Recorrência criada");
      qc.invalidateQueries({ queryKey: ["recorrencias"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpenSheet(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async (r: any) => {
      const next = r.status === "ativo" ? "pausado" : "ativo";
      const { error } = await supabase.from("recurring_contracts").update({ status: next }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recorrencias"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recorrência excluída");
      qc.invalidateQueries({ queryKey: ["recorrencias"] });
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const generateTx = useMutation({
    mutationFn: async (r: any) => {
      if (r.status !== "ativo") throw new Error("Recorrência não está ativa");
      if (r.installments_total != null && (r.installments_generated ?? 0) >= r.installments_total) {
        throw new Error("Todas as mensalidades já foram geradas");
      }
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Sem organização");

      // Evita duplicidade: mesma recorrência + mesmo due_date pendente
      const { data: existing } = await supabase
        .from("financial_transactions")
        .select("id")
        .eq("recurring_contract_id", r.id)
        .eq("due_date", r.next_due_date)
        .limit(1);
      if (existing && existing.length > 0) {
        throw new Error("Já existe transação para esta data");
      }

      const amt = Number(r.amount);
      const { error: insErr } = await supabase.from("financial_transactions").insert({
        organization_id: org,
        type: "receita_propria",
        status: "pendente",
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
      if (insErr) throw insErr;

      const generated = (r.installments_generated ?? 0) + 1;
      const reachedEnd = r.installments_total != null && generated >= r.installments_total;
      const update: any = { installments_generated: generated };
      if (reachedEnd) {
        update.status = "inativo";
      } else {
        update.next_due_date = nextAnchoredDate(r.next_due_date, r.frequency, r.anchor_day);
      }
      const { error: updErr } = await supabase
        .from("recurring_contracts")
        .update(update)
        .eq("id", r.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success("Transação gerada no Financeiro");
      qc.invalidateQueries({ queryKey: ["recorrencias"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Recorrências"
        subtitle="Contratos e mensalidades recorrentes"
        actions={
          <Button
            onClick={() => { setEditing(null); setOpenSheet(true); }}
            className="gap-2"
            style={{ background: "var(--gradient-primary)", color: "var(--background)" }}
          >
            <Plus className="h-4 w-4" /> Nova recorrência
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <MetricCard label="Receita mensal estimada" value={formatBRL(totalMonthly)} hint="Soma normalizada por mês" />
        <MetricCard label="Contratos ativos" value={String(activeRows.length)} hint={`${rows.length} no total`} />
        <MetricCard label="Próximo vencimento" value={formatDate(nextDue)} hint={nextDue ? clientById[activeRows[0]?.client_id]?.name ?? "" : "—"} />
      </div>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente ou descrição..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={freqFilter} onValueChange={setFreqFilter}>
          <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas frequências</SelectItem>
            {FREQS.map((f) => <SelectItem key={f} value={f}>{RECURRENCE_LABELS[f]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Repeat className="h-6 w-6" />}
          title="Sem recorrências"
          description="Cadastre contratos recorrentes para gerar receitas mensais automaticamente."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((r: any) => (
            <div key={r.id} className="glass rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{r.description}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                  <span>{clientById[r.client_id]?.name ?? "—"}</span>
                  <span>·</span>
                  <span>{RECURRENCE_LABELS[r.frequency as RecurrenceFreq]}</span>
                  <span>·</span>
                  <span>Próx.: {formatDate(r.next_due_date)}</span>
                  {r.installments_total != null && (
                    <>
                      <span>·</span>
                      <span>Geradas: {r.installments_generated ?? 0}/{r.installments_total}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="font-display font-semibold text-lg">{formatBRL(r.amount)}</div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  title="Gerar transação"
                  onClick={() => generateTx.mutate(r)}
                  disabled={
                    r.status !== "ativo" ||
                    generateTx.isPending ||
                    (r.installments_total != null && (r.installments_generated ?? 0) >= r.installments_total)
                  }
                >
                  <Zap className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" title={r.status === "ativo" ? "Pausar" : "Ativar"} onClick={() => toggleStatus.mutate(r)}>
                  {r.status === "ativo" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" title="Editar" onClick={() => { setEditing(r); setOpenSheet(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" title="Excluir" onClick={() => setToDelete(r)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={openSheet} onOpenChange={(o) => { setOpenSheet(o); if (!o) setEditing(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? "Editar recorrência" : "Nova recorrência"}</SheetTitle></SheetHeader>
          <RecurrenceForm
            initial={editing}
            clients={clients}
            banks={banks}
            services={services}
            onSubmit={(d: any) => save.mutate(d)}
            loading={save.isPending}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Transações já geradas serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && remove.mutate(toDelete.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RecurrenceForm({ initial, clients, banks, services, onSubmit, loading }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    client_id: initial?.client_id ?? "",
    service_id: initial?.service_id ?? "",
    description: initial?.description ?? "",
    amount: initial?.amount?.toString() ?? "",
    frequency: (initial?.frequency ?? "mensal") as RecurrenceFreq,
    start_date: initial?.start_date ?? today,
    installments_total: initial?.installments_total?.toString() ?? "12",
    default_bank_id: initial?.default_bank_id ?? "",
    notes: initial?.notes ?? "",
    status: initial?.status ?? "ativo",
  });

  const generated = initial?.installments_generated ?? 0;
  const startDateLocked = generated > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.client_id) { toast.error("Selecione um cliente"); return; }
        if (!form.amount || Number(form.amount) <= 0) { toast.error("Valor inválido"); return; }
        const qtd = Number(form.installments_total);
        if (!Number.isInteger(qtd) || qtd < 1) { toast.error("Quantidade de mensalidades inválida"); return; }
        if (startDateLocked && qtd < generated) {
          toast.error(`Quantidade não pode ser menor que ${generated} (já gerada)`); return;
        }
        onSubmit(form);
      }}
      className="space-y-4 mt-6"
    >
      <div className="space-y-2">
        <Label>Cliente *</Label>
        <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
          <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Serviço</Label>
        <Select value={form.service_id || "none"} onValueChange={(v) => setForm({ ...form, service_id: v === "none" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {services.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Descrição *</Label>
        <Input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Valor *</Label>
          <Input required type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Frequência</Label>
          <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as RecurrenceFreq })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{FREQS.map((f) => <SelectItem key={f} value={f}>{RECURRENCE_LABELS[f]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Data da 1ª mensalidade *</Label>
          <Input
            required
            type="date"
            value={form.start_date}
            disabled={startDateLocked}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
          {startDateLocked && (
            <p className="text-xs text-muted-foreground">Bloqueada: já existem parcelas geradas.</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Qtd. de mensalidades *</Label>
          <Input
            required
            type="number"
            min="1"
            step="1"
            value={form.installments_total}
            onChange={(e) => setForm({ ...form, installments_total: e.target.value })}
          />
          {generated > 0 && (
            <p className="text-xs text-muted-foreground">Geradas até agora: {generated}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Banco padrão</Label>
        <Select value={form.default_bank_id || "none"} onValueChange={(v) => setForm({ ...form, default_bank_id: v === "none" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="pausado">Pausado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
      </div>
      <Button type="submit" disabled={loading} className="w-full" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
        {loading ? "Salvando..." : initial ? "Salvar alterações" : "Criar recorrência"}
      </Button>
    </form>
  );
}
