import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Wallet, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui-helpers";
import { formatBRL, formatDate, getCurrentOrgId } from "@/lib/fynsinc";

export const Route = createFileRoute("/_app/financeiro")({
  component: FinanceiroPage,
  head: () => ({ meta: [{ title: "Financeiro — Fyn Sinc" }] }),
});

const TX_TYPES = [
  { v: "receita_propria", l: "Receita própria" },
  { v: "despesa_propria", l: "Despesa própria" },
  { v: "transferencia", l: "Transferência" },
] as const;

function FinanceiroPage() {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [payTx, setPayTx] = useState<any | null>(null);

  const { data: tx = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .order("due_date", { ascending: false, nullsFirst: false })
        .limit(200);
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

  const markPaid = useMutation({
    mutationFn: async ({ id, bankId, paidAt, hadFee, feeAmount, feeProvider, orgId }: any) => {
      const { data: updated, error } = await supabase
        .from("financial_transactions")
        .update({ status: "pago", paid_at: paidAt, bank_id: bankId })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      if (hadFee && feeAmount > 0) {
        const { error: e2 } = await supabase.from("financial_transactions").insert({
          organization_id: orgId,
          type: "taxa",
          parent_transaction_id: id,
          client_id: updated.client_id,
          bank_id: bankId,
          fornecedor: feeProvider,
          description: `Taxa ${feeProvider} - ${updated.description}`,
          amount_gross: feeAmount,
          due_date: paidAt,
          paid_at: paidAt,
          status: "pago",
        });
        if (e2) throw e2;
        await supabase
          .from("financial_transactions")
          .update({ amount_net: Number(updated.amount_gross) - Number(feeAmount) })
          .eq("id", id);
      }
    },
    onSuccess: () => {
      toast.success("Lançamento marcado como pago");
      qc.invalidateQueries();
      setPayTx(null);
    },
    onError: (e: any) => toast.error(e.message),
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

      {tx.length === 0 ? (
        <EmptyState icon={<Wallet className="h-6 w-6" />} title="Sem lançamentos" description="Crie o primeiro lançamento financeiro." />
      ) : (
        <div className="space-y-2">
          {tx.map((t) => {
            const positive = ["receita_propria", "comissao", "cashback", "repasse_recebido"].includes(t.type);
            const client = clients.find((c) => c.id === t.client_id);
            return (
              <div key={t.id} className="glass rounded-xl p-3 md:p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{t.description}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span className="capitalize">{t.type.replace("_", " ")}</span>
                    {client && <><span>·</span><span>{client.name}</span></>}
                    <span>·</span>
                    <span>{formatDate(t.due_date)}</span>
                  </div>
                </div>
                <div className={`font-display font-semibold text-sm md:text-base ${positive ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]"}`}>
                  {formatBRL(t.amount_gross)}
                </div>
                <StatusBadge status={t.status} />
                {t.status !== "pago" && (
                  <Button size="icon" variant="ghost" onClick={() => setPayTx(t)}>
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!payTx} onOpenChange={(o) => !o && setPayTx(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como pago</DialogTitle></DialogHeader>
          {payTx && <MarkPaidForm tx={payTx} banks={banks} onSubmit={(d: any) => markPaid.mutate(d)} loading={markPaid.isPending} />}
        </DialogContent>
      </Dialog>
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

function MarkPaidForm({ tx, banks, onSubmit, loading }: any) {
  const [bankId, setBankId] = useState(tx.bank_id || "");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [hadFee, setHadFee] = useState(false);
  const [feeAmount, setFeeAmount] = useState("");
  const [feeProvider, setFeeProvider] = useState("Asaas");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const orgId = await getCurrentOrgId();
        onSubmit({ id: tx.id, bankId: bankId || null, paidAt, hadFee, feeAmount: Number(feeAmount || 0), feeProvider, orgId });
      }}
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">{tx.description} — <span className="font-medium text-foreground">{formatBRL(tx.amount_gross)}</span></p>
      <div className="space-y-2">
        <Label>Banco</Label>
        <Select value={bankId} onValueChange={setBankId}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Data do pagamento</Label><Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div>
      {tx.type === "receita_propria" && (
        <>
          <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2.5">
            <Label htmlFor="had-fee" className="cursor-pointer">Teve taxa?</Label>
            <Switch id="had-fee" checked={hadFee} onCheckedChange={setHadFee} />
          </div>
          {hadFee && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Valor da taxa</Label><Input type="number" step="0.01" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Select value={feeProvider} onValueChange={setFeeProvider}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Asaas", "Stripe", "Mercado Pago", "Banco", "Cartão", "Outro"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </>
      )}
      <Button type="submit" disabled={loading} className="w-full" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
        {loading ? "Salvando..." : "Confirmar pagamento"}
      </Button>
    </form>
  );
}
