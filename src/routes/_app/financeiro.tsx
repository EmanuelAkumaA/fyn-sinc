import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Wallet, CheckCircle2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui-helpers";
import { formatBRL, formatDate, getCurrentOrgId } from "@/lib/fynsinc";
import { PayTransactionDialog } from "@/components/pay-transaction-dialog";


export const Route = createFileRoute("/_app/financeiro")({
  component: FinanceiroPage,
  head: () => ({ meta: [{ title: "Financeiro — Fyn Sinc" }] }),
});

const TX_TYPES = [
  { v: "receita_propria", l: "Receita própria" },
  { v: "despesa_propria", l: "Despesa própria" },
  { v: "transferencia", l: "Transferência" },
] as const;

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(start), to: fmt(end) };
}

function FinanceiroPage() {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [payTx, setPayTx] = useState<any | null>(null);
  const [toDelete, setToDelete] = useState<any | null>(null);

  // Filtros
  const [period, setPeriod] = useState<string>("this_month");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const range: { from: string | null; to: string | null } =
    period === "this_month" ? monthRange(0)
    : period === "last_month" ? monthRange(-1)
    : period === "next_month" ? monthRange(1)
    : period === "custom" ? { from: customFrom || null, to: customTo || null }
    : { from: null, to: null };

  const { data: tx = [] } = useQuery({
    queryKey: ["transactions", period, typeFilter, statusFilter, range.from, range.to],
    queryFn: async () => {
      let q = supabase
        .from("financial_transactions")
        .select("*")
        .order("due_date", { ascending: false, nullsFirst: false })
        .limit(500);
      if (range.from) q = q.gte("due_date", range.from);
      if (range.to) q = q.lte("due_date", range.to);
      if (typeFilter !== "all") q = q.eq("type", typeFilter as any);
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      const { data, error } = await q;
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

  const create = useMutation({
    mutationFn: async (p: any) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Sem organização");
      const { error } = await supabase.from("financial_transactions").insert({ ...p, organization_id: org });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento criado");
      qc.invalidateQueries();
      setOpenNew(false);
    },
    onError: (e: any) => toast.error(e.message),
  });




  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento excluído");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setToDelete(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setToDelete(null);
    },
  });

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Lançamentos, taxas e transferências"
        actions={
          <Sheet open={openNew} onOpenChange={setOpenNew}>
            <SheetTrigger asChild>
              <Button className="gap-2" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
                <Plus className="h-4 w-4" /> Novo lançamento
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader><SheetTitle>Novo lançamento</SheetTitle></SheetHeader>
              <NewTxForm
                clients={clients}
                banks={banks}
                services={services}
                onSubmit={(d: any) => create.mutate(d)}
                loading={create.isPending}
              />
            </SheetContent>
          </Sheet>
        }
      />

      <div className="glass rounded-xl p-3 md:p-4 mb-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1 min-w-[160px]">
          <Label className="text-xs">Período</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">Este mês</SelectItem>
              <SelectItem value="last_month">Mês anterior</SelectItem>
              <SelectItem value="next_month">Próximo mês</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {period === "custom" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </>
        )}
        <div className="space-y-1 min-w-[160px]">
          <Label className="text-xs">Tipo</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {TX_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 min-w-[140px]">
          <Label className="text-xs">Status</Label>
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
      </div>

      {tx.length === 0 ? (
        <EmptyState icon={<Wallet className="h-6 w-6" />} title="Sem lançamentos" description="Nenhum lançamento encontrado para os filtros selecionados." />
      ) : (
        <div className="space-y-2">
          {tx.map((t) => {
            const positive = ["receita_propria", "comissao", "cashback", "repasse_recebido"].includes(t.type);
            const client = clients.find((c) => c.id === t.client_id);
            return (
              <div key={t.id} className="glass rounded-xl p-3 md:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  {/* Coluna info */}
                  <div className="flex items-start justify-between gap-3 sm:flex-1 sm:min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{t.description}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="capitalize">{t.type.replace("_", " ")}</span>
                        {client && <><span>·</span><span className="truncate max-w-[10rem]">{client.name}</span></>}
                        <span>·</span>
                        <span>{formatDate(t.due_date)}</span>
                      </div>
                    </div>
                    {/* Valor — no mobile aparece ao lado da descrição */}
                    <div className={`font-display font-semibold text-sm md:text-base shrink-0 ${positive ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]"}`}>
                      {formatBRL(t.amount_gross)}
                    </div>
                  </div>

                  {/* Linha de ações (mobile: linha própria) */}
                  <div className="flex items-center justify-end gap-2 sm:shrink-0">
                    <StatusBadge status={t.status} />
                    {t.status !== "pago" && (
                      <Button size="icon" variant="ghost" onClick={() => setPayTx(t)} aria-label="Marcar como pago">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setToDelete(t)}
                      aria-label="Excluir lançamento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete ? `"${toDelete.description}" será removido. Esta ação não pode ser desfeita.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (toDelete) remove.mutate(toDelete.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PayTransactionDialog tx={payTx} onOpenChange={(o) => !o && setPayTx(null)} />

    </>
  );
}

function NewTxForm({ clients, banks, services, onSubmit, loading }: any) {
  const [form, setForm] = useState({
    type: "receita_propria",
    description: "",
    amount_gross: "",
    client_id: "",
    service_id: "",
    bank_id: "",
    transfer_to_bank_id: "",
    due_date: new Date().toISOString().slice(0, 10),
    category: "",
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({
      ...form,
      amount_gross: Number(form.amount_gross),
      client_id: form.client_id || null,
      service_id: form.service_id || null,
      bank_id: form.bank_id || null,
      transfer_to_bank_id: form.transfer_to_bank_id || null,
    }); }} className="space-y-4 mt-6">
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TX_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Para repasses/aportes e planos, use os módulos específicos.</p>
      </div>
      <div className="space-y-2"><Label>Descrição *</Label><Input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Valor *</Label><Input required type="number" step="0.01" value={form.amount_gross} onChange={(e) => setForm({ ...form, amount_gross: e.target.value })} /></div>
        <div className="space-y-2"><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
      </div>
      {form.type !== "transferencia" && (
        <div className="space-y-2">
          <Label>Cliente</Label>
          <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
            <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
            <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {form.type === "receita_propria" && (
        <div className="space-y-2">
          <Label>Serviço</Label>
          <Select value={form.service_id} onValueChange={(v) => setForm({ ...form, service_id: v })}>
            <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
            <SelectContent>{services.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label>{form.type === "transferencia" ? "Banco origem" : "Banco"}</Label>
        <Select value={form.bank_id} onValueChange={(v) => setForm({ ...form, bank_id: v })}>
          <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
          <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {form.type === "transferencia" && (
        <div className="space-y-2">
          <Label>Banco destino</Label>
          <Select value={form.transfer_to_bank_id} onValueChange={(v) => setForm({ ...form, transfer_to_bank_id: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <Button type="submit" disabled={loading} className="w-full" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
        {loading ? "Salvando..." : "Criar lançamento"}
      </Button>
    </form>
  );
}

