import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, Pencil, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui-helpers";
import { MetricCard } from "@/components/metric-card";
import { formatBRL, getCurrentOrgId } from "@/lib/fynsinc";

export const Route = createFileRoute("/_app/planos")({
  component: PlanosPage,
  head: () => ({ meta: [{ title: "Planos/Ferramentas — Fyn Sinc" }] }),
});

const STATUSES = ["pendente", "recebido", "pago_fornecedor", "concluido", "cancelado"] as const;

function PlanosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("third_party_plans").select("*").order("created_at", { ascending: false });
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

  const clientById = useMemo(() => Object.fromEntries(clients.map((c: any) => [c.id, c])), [clients]);
  const filtered = plans.filter((p: any) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    const term = search.toLowerCase();
    const clientName = clientById[p.client_id]?.name?.toLowerCase() ?? "";
    return p.plan_name.toLowerCase().includes(term) || p.fornecedor.toLowerCase().includes(term) || clientName.includes(term);
  });

  const save = useMutation({
    mutationFn: async (payload: any) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Organização não encontrada");
      const fullValue = Number(payload.full_value || 0);
      const received = Number(payload.amount_received_from_client || 0);
      const paid = Number(payload.amount_paid_to_supplier || 0);
      const commissionPct = Number(payload.commission_pct || 0);
      const commissionValue = payload.commission_value ? Number(payload.commission_value) : Math.max(received - paid, 0);
      const data = {
        client_id: payload.client_id,
        bank_id: payload.bank_id || null,
        plan_name: payload.plan_name,
        fornecedor: payload.fornecedor,
        period: payload.period || null,
        payment_method: payload.payment_method || null,
        full_value: fullValue || null,
        amount_received_from_client: received,
        amount_paid_to_supplier: paid,
        commission_pct: commissionPct,
        commission_value: commissionValue,
        cashback_expected: Number(payload.cashback_expected || 0),
        cashback_received: Number(payload.cashback_received || 0),
        notes: payload.notes || null,
        status: payload.status,
      };
      const result = editing?.id
        ? await supabase.from("third_party_plans").update(data).eq("id", editing.id)
        : await supabase.from("third_party_plans").insert({ ...data, organization_id: org });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success(editing ? "Plano atualizado" : "Plano criado");
      qc.invalidateQueries({ queryKey: ["plans"] });
      qc.invalidateQueries({ queryKey: ["client-plans"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const conclude = useMutation({
    mutationFn: async (plan: any) => {
      const { error } = await supabase.from("third_party_plans").update({ status: "concluido" }).eq("id", plan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plano concluído");
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const commissionTotal = plans.reduce((sum: number, p: any) => sum + Number(p.commission_value ?? 0), 0);
  const cashbackOpen = plans.reduce((sum: number, p: any) => sum + Math.max(Number(p.cashback_expected ?? 0) - Number(p.cashback_received ?? 0), 0), 0);
  const supplierOpen = plans.reduce((sum: number, p: any) => p.status !== "pago_fornecedor" && p.status !== "concluido" ? sum + Number(p.amount_paid_to_supplier ?? 0) : sum, 0);

  return (
    <>
      <PageHeader
        title="Planos/Ferramentas"
        subtitle="Compras de terceiros, comissões e cashback"
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
            <Plus className="h-4 w-4" /> Novo plano
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <MetricCard label="Comissão prevista" value={formatBRL(commissionTotal)} hint="Total dos planos" tone="success" />
        <MetricCard label="Cashback em aberto" value={formatBRL(cashbackOpen)} hint="Esperado menos recebido" tone="primary" />
        <MetricCard label="A pagar fornecedor" value={formatBRL(supplierOpen)} hint="Planos não liquidados" tone="destructive" />
      </div>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar plano, fornecedor ou cliente..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<CreditCard className="h-6 w-6" />} title="Nenhum plano" description="Cadastre ferramentas e planos comprados para clientes." />
      ) : (
        <div className="space-y-2">
          {filtered.map((p: any) => (
            <div key={p.id} className="glass rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{p.plan_name}</span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                  <span>{clientById[p.client_id]?.name ?? "Cliente"}</span>
                  <span>·</span>
                  <span>{p.fornecedor}</span>
                  {p.period && <><span>·</span><span>{p.period}</span></>}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm md:text-right">
                <MiniValue label="Recebido" value={formatBRL(p.amount_received_from_client)} />
                <MiniValue label="Fornecedor" value={formatBRL(p.amount_paid_to_supplier)} />
                <MiniValue label="Comissão" value={formatBRL(p.commission_value)} />
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                {p.status !== "concluido" && <Button size="icon" variant="ghost" onClick={() => conclude.mutate(p)} disabled={conclude.isPending}><CheckCircle2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? "Editar plano" : "Novo plano"}</SheetTitle></SheetHeader>
          <PlanForm initial={editing} clients={clients} banks={banks} loading={save.isPending} onSubmit={(data) => save.mutate(data)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function MiniValue({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] text-muted-foreground">{label}</div><div className="font-medium whitespace-nowrap">{value}</div></div>;
}

function PlanForm({ initial, clients, banks, loading, onSubmit }: { initial: any | null; clients: any[]; banks: any[]; loading: boolean; onSubmit: (data: any) => void }) {
  const [form, setForm] = useState({
    client_id: initial?.client_id ?? "",
    bank_id: initial?.bank_id ?? "",
    plan_name: initial?.plan_name ?? "",
    fornecedor: initial?.fornecedor ?? "",
    period: initial?.period ?? "",
    payment_method: initial?.payment_method ?? "",
    full_value: initial?.full_value?.toString() ?? "",
    amount_received_from_client: initial?.amount_received_from_client?.toString() ?? "",
    amount_paid_to_supplier: initial?.amount_paid_to_supplier?.toString() ?? "",
    commission_pct: initial?.commission_pct?.toString() ?? "0",
    commission_value: initial?.commission_value?.toString() ?? "",
    cashback_expected: initial?.cashback_expected?.toString() ?? "0",
    cashback_received: initial?.cashback_received?.toString() ?? "0",
    status: initial?.status ?? "pendente",
    notes: initial?.notes ?? "",
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4 mt-6">
      <div className="space-y-2">
        <Label>Cliente *</Label>
        <Select required value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Plano *</Label><Input required value={form.plan_name} onChange={(e) => setForm({ ...form, plan_name: e.target.value })} /></div>
        <div className="space-y-2"><Label>Fornecedor *</Label><Input required value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Período</Label><Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="Mensal, anual..." /></div>
        <div className="space-y-2"><Label>Forma de pagamento</Label><Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Recebido do cliente</Label><CurrencyInput value={form.amount_received_from_client} onValueChange={(v: string) => setForm({ ...form, amount_received_from_client: v })} /></div>
        <div className="space-y-2"><Label>Pago ao fornecedor</Label><CurrencyInput value={form.amount_paid_to_supplier} onValueChange={(v: string) => setForm({ ...form, amount_paid_to_supplier: v })} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2"><Label>Valor cheio</Label><Input type="number" step="0.01" value={form.full_value} onChange={(e) => setForm({ ...form, full_value: e.target.value })} /></div>
        <div className="space-y-2"><Label>Comissão %</Label><Input type="number" step="0.01" value={form.commission_pct} onChange={(e) => setForm({ ...form, commission_pct: e.target.value })} /></div>
        <div className="space-y-2"><Label>Comissão R$</Label><Input type="number" step="0.01" value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Cashback previsto</Label><Input type="number" step="0.01" value={form.cashback_expected} onChange={(e) => setForm({ ...form, cashback_expected: e.target.value })} /></div>
        <div className="space-y-2"><Label>Cashback recebido</Label><Input type="number" step="0.01" value={form.cashback_received} onChange={(e) => setForm({ ...form, cashback_received: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Banco</Label>
          <Select value={form.bank_id} onValueChange={(v) => setForm({ ...form, bank_id: v })}>
            <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
            <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      <Button type="submit" disabled={loading} className="w-full" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
        {loading ? "Salvando..." : "Salvar plano"}
      </Button>
    </form>
  );
}
