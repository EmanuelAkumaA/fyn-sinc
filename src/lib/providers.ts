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


/** Adiciona N períodos de uma frequência a uma data ISO (yyyy-mm-dd). */
export function addProviderPaymentPeriod(
  dateISO: string,
  frequency: ExpenseFrequency,
  installmentIndex: number,
): string {
  if (installmentIndex <= 0 || frequency === "unica") return dateISO;
  const d = new Date(dateISO + "T00:00:00");
  switch (frequency) {
    case "semanal":
      d.setDate(d.getDate() + 7 * installmentIndex);
      break;
    case "quinzenal":
      d.setDate(d.getDate() + 15 * installmentIndex);
      break;
    case "mensal":
      d.setMonth(d.getMonth() + 1 * installmentIndex);
      break;
    case "bimestral":
      d.setMonth(d.getMonth() + 2 * installmentIndex);
      break;
    case "trimestral":
      d.setMonth(d.getMonth() + 3 * installmentIndex);
      break;
    case "semestral":
      d.setMonth(d.getMonth() + 6 * installmentIndex);
      break;
    case "anual":
      d.setFullYear(d.getFullYear() + 1 * installmentIndex);
      break;
  }
  return d.toISOString().slice(0, 10);
}

export type ScheduleItem = {
  installment_number: number;
  installments_total: number | null;
  due_date: string;
  amount: number;
  description: string;
};

export type ScheduleInput = {
  assignment_type: AssignmentType;
  compensation_type: CompensationType;
  fixed_amount: number | null | undefined;
  percentage: number | null | undefined;
  frequency: ExpenseFrequency | null | undefined;
  first_due_date: string;
  recurrence_mode: RecurrenceMode;
  installments_count: number | null | undefined;
  revenue: number;
  providerName?: string;
  clientName?: string | null;
  serviceName?: string | null;
};

export function generateAssignmentSchedule(input: ScheduleInput): ScheduleItem[] {
  const amount = computeProviderCost(
    input.compensation_type,
    input.fixed_amount,
    input.percentage,
    input.revenue,
  );
  if (amount <= 0) return [];
  const freq: ExpenseFrequency =
    input.assignment_type === "pontual" ? "unica" : (input.frequency ?? "mensal");

  const isContinuous = input.recurrence_mode === "continuous";
  const total =
    input.assignment_type === "pontual" || freq === "unica"
      ? 1
      : isContinuous
        ? 1
        : Math.max(1, Math.floor(input.installments_count ?? 1));
  const totalLabel: number | null = isContinuous ? null : total;

  const items: ScheduleItem[] = [];
  for (let i = 0; i < total; i++) {
    const due = addProviderPaymentPeriod(input.first_due_date, freq, i);
    const parts = [
      "Pagamento operacional",
      input.providerName,
      input.serviceName,
      input.clientName,
    ].filter(Boolean);
    const base = parts.join(" — ");
    const parcela = totalLabel ? `Parcela ${i + 1}/${totalLabel}` : `Parcela ${i + 1}`;
    items.push({
      installment_number: i + 1,
      installments_total: totalLabel,
      due_date: due,
      amount,
      description: `${base} — ${parcela}`,
    });
  }
  return items;
}

/** Faz upsert idempotente do cronograma. Não toca em parcelas pagas/lançadas. */
export async function persistAssignmentSchedule(args: {
  organization_id: string;
  provider_id: string;
  assignment_id: string;
  client_id: string | null;
  service_id: string | null;
  schedule: ScheduleItem[];
}) {
  if (args.schedule.length === 0) return { created: 0, updated: 0, cancelled: 0 };

  const { data: existing, error: exErr } = await supabase
    .from("provider_payables")
    .select("id, installment_number, status, financial_transaction_id, due_date, amount")
    .eq("provider_assignment_id", args.assignment_id);
  if (exErr) throw exErr;

  const byInstallment = new Map<number, any>();
  for (const r of (existing ?? []) as any[]) {
    if (r.installment_number != null) byInstallment.set(r.installment_number, r);
  }

  let created = 0,
    updated = 0,
    cancelled = 0;

  const lastInstallment = Math.max(...args.schedule.map((s) => s.installment_number));

  for (const item of args.schedule) {
    const cur = byInstallment.get(item.installment_number);
    if (!cur) {
      const { error } = await supabase.from("provider_payables").insert({
        organization_id: args.organization_id,
        provider_id: args.provider_id,
        provider_assignment_id: args.assignment_id,
        client_id: args.client_id,
        service_id: args.service_id,
        amount: item.amount,
        due_date: item.due_date,
        reference_month: monthAnchor(item.due_date),
        description: item.description,
        installment_number: item.installment_number,
        installments_total: item.installments_total,
        status: "nao_lancada",
      } as any);
      if (error) throw error;
      created++;
    } else if (
      cur.status === "nao_lancada" &&
      !cur.financial_transaction_id &&
      (Number(cur.amount) !== item.amount || cur.due_date !== item.due_date)
    ) {
      const { error } = await supabase
        .from("provider_payables")
        .update({
          amount: item.amount,
          due_date: item.due_date,
          reference_month: monthAnchor(item.due_date),
          description: item.description,
          installments_total: item.installments_total,
        } as any)
        .eq("id", cur.id);
      if (error) throw error;
      updated++;
    }
  }

  // Cancela ocorrências futuras excedentes (não pagas / não lançadas).
  for (const cur of (existing ?? []) as any[]) {
    if (
      cur.installment_number != null &&
      cur.installment_number > lastInstallment &&
      cur.status === "nao_lancada" &&
      !cur.financial_transaction_id
    ) {
      const { error } = await supabase
        .from("provider_payables")
        .update({ status: "cancelada" })
        .eq("id", cur.id);
      if (error) throw error;
      cancelled++;
    }
  }

  // Atualiza end_date com a última due_date do cronograma.
  const lastDue = args.schedule[args.schedule.length - 1]?.due_date ?? null;
  if (lastDue) {
    await supabase
      .from("provider_assignments")
      .update({ end_date: lastDue } as any)
      .eq("id", args.assignment_id);
  }

  return { created, updated, cancelled };
}

/** Lança parcelas no Financeiro conforme política. */
export async function applyLaunchBehavior(args: {
  organization_id: string;
  provider_id: string;
  assignment_id: string;
  launch_behavior: LaunchBehavior;
}) {
  if (args.launch_behavior === "planning_only") return;

  const { data: payables, error } = await supabase
    .from("provider_payables")
    .select("*")
    .eq("provider_assignment_id", args.assignment_id)
    .neq("status", "cancelada")
    .order("installment_number", { ascending: true });
  if (error) throw error;

  const list = ((payables ?? []) as any[]).filter((p) => !p.financial_transaction_id);
  const target = args.launch_behavior === "launch_first" ? list.slice(0, 1) : list;

  for (const p of target) {
    await launchPayableInFinance({
      id: p.id,
      organization_id: args.organization_id,
      provider_id: args.provider_id,
      client_id: p.client_id,
      service_id: p.service_id,
      description: p.description,
      amount: Number(p.amount ?? 0),
      due_date: p.due_date,
      bank_id: p.bank_id,
      notes: p.notes,
      financial_transaction_id: p.financial_transaction_id,
    });
  }
}
