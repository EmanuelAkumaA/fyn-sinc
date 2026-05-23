import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Invalida todos os caches afetados por mutações financeiras. */
export function invalidateFinanceCaches(qc: QueryClient) {
  [
    "dashboard-transactions",
    "dashboard-banks",
    "dashboard-wallets",
    "dashboard-bank-breakdown",
    "banks",
    "banks-min",
    "bank-balances",
    "bank-breakdown",
    "bank-client-balances",
    "transactions",
    "client-summary",
    "client-transactions",
    "wallet",
    "calendar-events",
  ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export type CashbackInput = {
  organization_id: string;
  expense_id: string;
  bank_id: string | null;
  client_id: string | null;
  amount: number;
  date: string;
  status: "pago" | "pendente";
  expense_description: string;
};

/** Cria ou atualiza a transação de cashback vinculada a uma despesa. */
export async function upsertCashbackForExpense(input: CashbackInput) {
  const desc = `Cashback de ${input.expense_description}`;
  const payload = {
    organization_id: input.organization_id,
    type: "cashback" as const,
    parent_transaction_id: input.expense_id,
    client_id: input.client_id,
    bank_id: input.bank_id,
    description: desc,
    amount_gross: input.amount,
    status: input.status,
    paid_at: input.status === "pago" ? input.date : null,
    due_date: input.date,
  };
  const existing = await supabase
    .from("financial_transactions")
    .select("id")
    .eq("parent_transaction_id", input.expense_id)
    .eq("type", "cashback")
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) {
    const { error } = await supabase
      .from("financial_transactions")
      .update(payload)
      .eq("id", existing.data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("financial_transactions").insert(payload);
    if (error) throw error;
  }
}

export type FeeInput = {
  organization_id: string;
  parent_transaction_id: string;
  client_id: string | null;
  bank_id: string | null;
  amount: number;
  paid_at: string;
  fornecedor: string;
  parent_description: string;
};

/** Cria ou atualiza a transação de taxa vinculada a um recebimento, evitando duplicidade. */
export async function upsertFeeForReceipt(input: FeeInput) {
  const payload = {
    organization_id: input.organization_id,
    type: "taxa" as const,
    parent_transaction_id: input.parent_transaction_id,
    client_id: input.client_id,
    bank_id: input.bank_id,
    fornecedor: input.fornecedor,
    description: `Taxa ${input.fornecedor} - ${input.parent_description}`,
    amount_gross: input.amount,
    due_date: input.paid_at,
    paid_at: input.paid_at,
    status: "pago" as const,
  };
  const existing = await supabase
    .from("financial_transactions")
    .select("id")
    .eq("parent_transaction_id", input.parent_transaction_id)
    .eq("type", "taxa")
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) {
    const { error } = await supabase
      .from("financial_transactions")
      .update(payload)
      .eq("id", existing.data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("financial_transactions").insert(payload);
    if (error) throw error;
  }
}

export type BankBreakdownRow = {
  bank_id: string;
  organization_id: string;
  bank_name: string;
  bank_type: string | null;
  status: string;
  color: string | null;
  logo_url: string | null;
  initial_balance: number;
  income_total: number;
  expense_total: number;
  commission_total: number;
  cashback_total: number;
  fees_total: number;
  repasse_received_total: number;
  repasse_used_total: number;
  transfer_in_total: number;
  transfer_out_total: number;
};

export type BankBreakdown = BankBreakdownRow & {
  total_balance: number;
  kuma_balance: number;
  client_funds_balance: number;
};

export function deriveBreakdown(r: BankBreakdownRow): BankBreakdown {
  const n = (v: any) => Number(v ?? 0);
  const income = n(r.income_total);
  const expense = n(r.expense_total);
  const commission = n(r.commission_total);
  const cashback = n(r.cashback_total);
  const fees = n(r.fees_total);
  const repRecv = n(r.repasse_received_total);
  const repUsed = n(r.repasse_used_total);
  const tIn = n(r.transfer_in_total);
  const tOut = n(r.transfer_out_total);
  const initial = n(r.initial_balance);
  const total_balance =
    initial + income + commission + cashback + repRecv + tIn - expense - fees - repUsed - tOut;
  const kuma_balance = income + commission + cashback - expense - fees;
  const client_funds_balance = repRecv - repUsed;
  return { ...r, total_balance, kuma_balance, client_funds_balance };
}
