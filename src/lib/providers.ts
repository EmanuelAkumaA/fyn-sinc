import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { addFrequency, monthlyEquivalent, computeFirstDueDate, monthAnchor, type ExpenseFrequency } from "@/lib/expenses";

export type ProviderType =
  | "funcionario"
  | "freelancer"
  | "prestador"
  | "empresa_terceirizada"
  | "consultor"
  | "especialista"
  | "outro";

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  funcionario: "Funcionário",
  freelancer: "Freelancer",
  prestador: "Prestador",
  empresa_terceirizada: "Empresa terceirizada",
  consultor: "Consultor",
  especialista: "Especialista",
  outro: "Outro",
};

export type AssignmentType = "pontual" | "recorrente";
export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  pontual: "Pontual",
  recorrente: "Recorrente",
};

export type CompensationType = "valor_fixo" | "porcentagem";
export const COMPENSATION_TYPE_LABELS: Record<CompensationType, string> = {
  valor_fixo: "Valor fixo",
  porcentagem: "Porcentagem",
};

export type ProviderStatus = "ativo" | "inativo";
export type AssignmentStatus = "ativo" | "pausado" | "encerrado" | "cancelado";
export type PayableStatus = "nao_lancada" | "lancada" | "paga" | "vencida" | "cancelada";

export const PAYABLE_STATUS_LABELS: Record<PayableStatus, string> = {
  nao_lancada: "Não lançada",
  lancada: "Lançada",
  paga: "Paga",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

export const providerSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  provider_type: z.enum([
    "funcionario",
    "freelancer",
    "prestador",
    "empresa_terceirizada",
    "consultor",
    "especialista",
    "outro",
  ]),
  document: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().max(160).email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  pix_key: z.string().trim().max(160).optional().or(z.literal("")),
  payment_notes: z.string().trim().max(500).optional().or(z.literal("")),
  status: z.enum(["ativo", "inativo"]).default("ativo"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type ProviderInput = z.infer<typeof providerSchema>;

export type RecurrenceMode = "finite" | "continuous";
export type LaunchBehavior = "planning_only" | "launch_first" | "launch_all";

export const assignmentSchema = z
  .object({
    provider_id: z.string().uuid(),
    client_id: z.string().uuid().nullable().optional(),
    service_id: z.string().uuid().nullable().optional(),
    client_recurring_contract_id: z.string().uuid().nullable().optional(),
    assignment_type: z.enum(["pontual", "recorrente"]),
    compensation_type: z.enum(["valor_fixo", "porcentagem"]),
    fixed_amount: z.number().nonnegative().nullable().optional(),
    percentage: z.number().min(0).max(100).nullable().optional(),
    frequency: z
      .enum(["unica", "semanal", "quinzenal", "mensal", "bimestral", "trimestral", "semestral", "anual"])
      .nullable()
      .optional(),
    start_date: z.string().min(1),
    end_date: z.string().nullable().optional(),
    first_due_date: z.string().min(1, "Data do primeiro vencimento obrigatória"),
    installments_count: z.number().int().min(1).nullable().optional(),
    recurrence_mode: z.enum(["finite", "continuous"]).default("finite"),
    auto_generate_payables: z.boolean().default(true),
    launch_behavior: z.enum(["planning_only", "launch_first", "launch_all"]).default("planning_only"),
    status: z.enum(["ativo", "pausado", "encerrado", "cancelado"]).default("ativo"),
    notes: z.string().max(1000).optional().or(z.literal("")),
  })
  .refine((v) => (v.compensation_type === "valor_fixo" ? v.fixed_amount != null : true), {
    message: "Valor fixo obrigatório",
    path: ["fixed_amount"],
  })
  .refine((v) => (v.compensation_type === "porcentagem" ? v.percentage != null : true), {
    message: "Percentual obrigatório",
    path: ["percentage"],
  })
  .refine(
    (v) =>
      v.recurrence_mode === "continuous" ||
      v.assignment_type === "pontual" ||
      (v.installments_count != null && v.installments_count >= 1),
    { message: "Quantidade de lançamentos obrigatória (mínimo 1)", path: ["installments_count"] },
  );

export type AssignmentInput = z.infer<typeof assignmentSchema>;

/** Calcula custo do prestador a partir de receita e configuração de remuneração. */
export function computeProviderCost(
  compensationType: CompensationType,
  fixedAmount: number | null | undefined,
  percentage: number | null | undefined,
  revenueAmount: number,
): number {
  if (compensationType === "valor_fixo") return Number(fixedAmount ?? 0);
  return revenueAmount * (Number(percentage ?? 0) / 100);
}

/** Equivalente mensal de um vínculo recorrente para somatórios. */
export function assignmentMonthlyCost(a: {
  assignment_type: AssignmentType;
  compensation_type: CompensationType;
  fixed_amount: number | null;
  frequency: string | null;
  status: AssignmentStatus;
}): number {
  if (a.status !== "ativo") return 0;
  if (a.assignment_type !== "recorrente") return 0;
  if (a.compensation_type !== "valor_fixo") return 0;
  return monthlyEquivalent(Number(a.fixed_amount ?? 0), a.frequency as ExpenseFrequency);
}

/** Gera a próxima obrigação para um vínculo recorrente. */
export function nextPayableDate(currentDueDate: string, frequency: ExpenseFrequency): string {
  return addFrequency(currentDueDate, frequency);
}

export { computeFirstDueDate, monthAnchor };

/** Cria financial_transaction a partir de um payable. Idempotente. */
export async function launchPayableInFinance(payable: {
  id: string;
  organization_id: string;
  provider_id: string;
  client_id: string | null;
  service_id: string | null;
  description: string;
  amount: number;
  due_date: string;
  bank_id: string | null;
  notes: string | null;
  financial_transaction_id: string | null;
}) {
  if (payable.financial_transaction_id) return payable.financial_transaction_id;

  const insertPayload: any = {
    organization_id: payable.organization_id,
    type: "despesa_propria",
    status: "pendente",
    description: payable.description,
    amount_gross: payable.amount,
    amount_net: payable.amount,
    due_date: payable.due_date,
    bank_id: payable.bank_id,
    client_id: payable.client_id,
    service_id: payable.service_id,
    provider_payable_id: payable.id,
    notes: payable.notes,
  };

  const { data: tx, error } = await supabase
    .from("financial_transactions")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error) throw error;

  const { error: upErr } = await supabase
    .from("provider_payables" as any)
    .update({
      financial_transaction_id: tx.id,
      status: "lancada",
      launched_at: new Date().toISOString(),
    })
    .eq("id", payable.id);
  if (upErr) throw upErr;

  return tx.id as string;
}

/** Gera uma obrigação para um vínculo, com guarda anti-duplicidade por (assignment, reference_month). */
export async function generateNextPayable(args: {
  organization_id: string;
  provider_id: string;
  assignment_id: string;
  client_id: string | null;
  service_id: string | null;
  amount: number;
  due_date: string;
  description: string;
}) {
  const referenceMonth = monthAnchor(args.due_date);
  const existing = await supabase
    .from("provider_payables")
    .select("id")
    .eq("provider_assignment_id", args.assignment_id)
    .eq("reference_month", referenceMonth)
    .maybeSingle();
  if (existing.error && existing.error.code !== "PGRST116") throw existing.error;
  if (existing.data?.id) return { id: existing.data.id as string, created: false };

  const { data, error } = await supabase
    .from("provider_payables")
    .insert({
      organization_id: args.organization_id,
      provider_id: args.provider_id,
      provider_assignment_id: args.assignment_id,
      client_id: args.client_id,
      service_id: args.service_id,
      amount: args.amount,
      due_date: args.due_date,
      reference_month: referenceMonth,
      description: args.description,
      status: "nao_lancada",
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string, created: true };
}

/** Cancela uma obrigação. Se já lançada no financeiro, desvincula a transação. */
export async function cancelPayable(payableId: string) {
  const { error } = await supabase
    .from("provider_payables")
    .update({ status: "cancelada", financial_transaction_id: null })
    .eq("id", payableId);
  if (error) throw error;
}

/** Receita prevista de um vínculo (recurring_contract.amount ou service.default_value). */
export async function fetchAssignmentExpectedRevenue(opts: {
  recurring_contract_id?: string | null;
  service_id?: string | null;
}): Promise<number> {
  if (opts.recurring_contract_id) {
    const { data } = await supabase
      .from("recurring_contracts")
      .select("amount")
      .eq("id", opts.recurring_contract_id)
      .maybeSingle();
    if (data?.amount != null) return Number(data.amount);
  }
  if (opts.service_id) {
    const { data } = await supabase
      .from("services")
      .select("default_value")
      .eq("id", opts.service_id)
      .maybeSingle();
    if (data?.default_value != null) return Number(data.default_value);
  }
  return 0;
}

