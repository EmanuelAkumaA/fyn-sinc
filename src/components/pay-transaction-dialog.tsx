import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL, getCurrentOrgId } from "@/lib/fynsinc";
import { upsertFeeForReceipt, invalidateFinanceCaches } from "@/lib/finance";

export type PayTx = {
  id: string;
  description: string;
  amount_gross: number | string;
  type: string;
  bank_id?: string | null;
  client_id?: string | null;
};

export function PayTransactionDialog({
  tx,
  onOpenChange,
}: {
  tx: PayTx | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: banks = [] } = useQuery({
    queryKey: ["banks-min"],
    queryFn: async () => (await supabase.from("banks").select("id, name").order("name")).data ?? [],
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
        await upsertFeeForReceipt({
          organization_id: orgId,
          parent_transaction_id: id,
          client_id: updated.client_id,
          bank_id: bankId,
          amount: feeAmount,
          paid_at: paidAt,
          fornecedor: feeProvider,
          parent_description: updated.description,
        });
        await supabase
          .from("financial_transactions")
          .update({ amount_net: Number(updated.amount_gross) - Number(feeAmount) })
          .eq("id", id);
      }
    },
    onSuccess: () => {
      toast.success("Lançamento marcado como pago");
      invalidateFinanceCaches(qc);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!tx} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Marcar como pago</DialogTitle></DialogHeader>
        {tx && (
          <MarkPaidForm
            tx={tx}
            banks={banks}
            onSubmit={(d: any) => markPaid.mutate(d)}
            loading={markPaid.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
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
      <p className="text-sm text-muted-foreground">{tx.description} — <span className="font-medium text-foreground">{formatBRL(Number(tx.amount_gross))}</span></p>
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
