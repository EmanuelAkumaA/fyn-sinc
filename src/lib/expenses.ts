import { supabase } from "@/integrations/supabase/client";

export type ExpenseType = "fixa" | "variavel" | "investimento";
export type ExpenseFrequency =
  | "unica"
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";
export type ExpensePlanStatus = "ativo" | "pausado" | "cancelado";
export type ExpenseOccurrenceStatus =
  | "nao_lancada"
  | "lancada"
  | "paga"
  | "vencida"
  | "pausada"
  | "cancelada";

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  fixa: "Fixa",
  variavel: "Variável",
  investimento: "Investimento",
};

export const FREQUENCY_LABELS: Record<ExpenseFrequency, string> = {
  unica: "Única",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const CLASSIFICATIONS = [
  "operacional",
  "investimento",
  "equipe",
  "financeiro",
  "infraestrutura",
  "marketing",
  "personalizado",
] as const;

export const DEFAULT_CATEGORIES: { name: string; classification: string }[] = [
  { name: "Plataformas e ferramentas", classification: "operacional" },
  { name: "Hospedagem e infraestrutura", classification: "infraestrutura" },
  { name: "IA e automações", classification: "operacional" },
  { name: "Marketing e anúncios", classification: "marketing" },
  { name: "Equipe e freelancers", classification: "equipe" },
  { name: "Impostos e contabilidade", classification: "financeiro" },
  { name: "Taxas financeiras", classification: "financeiro" },
  { name: "Serviços terceirizados", classification: "operacional" },
  { name: "Investimentos", classification: "investimento" },
  { name: "Equipamentos", classification: "investimento" },
  { name: "Deslocamento", classification: "operacional" },
  { name: "Assinaturas", classification: "operacional" },
  { name: "Outros", classification: "personalizado" },
];

/** Adiciona n períodos a uma data baseado na frequência. */
export function addFrequency(dateStr: string, freq: ExpenseFrequency): string {
  const d = new Date(dateStr + "T00:00:00");
  switch (freq) {
    case "unica":
      return dateStr;
    case "semanal":
      d.setDate(d.getDate() + 7);
      break;
    case "quinzenal":
      d.setDate(d.getDate() + 15);
      break;
    case "mensal":
      d.setMonth(d.getMonth() + 1);
      break;
    case "bimestral":
      d.setMonth(d.getMonth() + 2);
      break;
    case "trimestral":
      d.setMonth(d.getMonth() + 3);
      break;
    case "semestral":
      d.setMonth(d.getMonth() + 6);
      break;
    case "anual":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

/** Calcula equivalente mensal de uma despesa recorrente para somatórios "por mês". */
export function monthlyEquivalent(amount: number, freq: ExpenseFrequency | null | undefined): number {
  if (!freq || freq === "unica") return 0;
  const map: Record<Exclude<ExpenseFrequency, "unica">, number> = {
    semanal: 4.33,
    quinzenal: 2.17,
    mensal: 1,
    bimestral: 1 / 2,
    trimestral: 1 / 3,
    semestral: 1 / 6,
    anual: 1 / 12,
  };
  return amount * (map[freq as Exclude<ExpenseFrequency, "unica">] ?? 0);
}

/** Calcula próxima due_date a partir de start_date+frequência+due_day, garantindo >= today. */
export function computeFirstDueDate(startDate: string, dueDay: number | null | undefined): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate + "T00:00:00");
  const base = start > today ? start : today;
  if (dueDay && dueDay >= 1 && dueDay <= 31) {
    const y = base.getFullYear();
    const m = base.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const day = Math.min(dueDay, lastDay);
    let d = new Date(y, m, day);
    if (d < base) {
      const ny = m === 11 ? y + 1 : y;
      const nm = (m + 1) % 12;
      const lastNext = new Date(ny, nm + 1, 0).getDate();
      d = new Date(ny, nm, Math.min(dueDay, lastNext));
    }
    return d.toISOString().slice(0, 10);
  }
  return base.toISOString().slice(0, 10);
}

/** Retorna primeiro dia do mês (YYYY-MM-01) de uma data string. */
export function monthAnchor(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function ensureDefaultCategories(orgId: string) {
  const { data, error } = await (supabase as any)
    .from("expense_categories")
    .select("id")
    .eq("organization_id", orgId)
    .limit(1);
  if (error) throw error;
  if (data && data.length > 0) return;
  const rows = DEFAULT_CATEGORIES.map((c) => ({
    organization_id: orgId,
    name: c.name,
    classification: c.classification,
  }));
  await (supabase as any).from("expense_categories").insert(rows);
}

// ── Progresso por despesa ───────────────────────────────────────────────────
export type RecurrenceMode = "finite" | "continuous";

export type PlanProgress = {
  isContinuous: boolean;
  total: number | null;
  paid: number;
  launched: number;
  open: number;
  notLaunched: number;
  remaining: number | null;
  overdue: number;
  pending: number;
  nextDueDate: string | null;
  progressPct: number | null;
  paidAmount: number;
  launchedAmount: number;
  plannedAmount: number;
  remainingAmount: number | null;
};

export function computePlanProgress(
  plan: {
    recurrence_mode?: string | null;
    installments_count?: number | null;
    frequency?: string | null;
    amount?: number | null;
  },
  occurrences: Array<{
    status: string;
    due_date: string;
    amount: number | string | null;
    paid_at?: string | null;
    financial_transaction_id?: string | null;
  }>,
  today: string = new Date().toISOString().slice(0, 10),
): PlanProgress {
  const isContinuous = (plan.recurrence_mode ?? "finite") === "continuous";

  const active = occurrences.filter((o) => o.status !== "cancelada");
  const paidOccs = active.filter((o) => o.status === "paga");
  const launchedOccs = active.filter((o) => !!o.financial_transaction_id);
  const notLaunchedOccs = active.filter(
    (o) => !o.financial_transaction_id && o.status !== "pausada",
  );

  const paid = paidOccs.length;
  const launched = launchedOccs.length;
  const open = Math.max(0, launched - paid);
  const notLaunched = notLaunchedOccs.length;
  const overdue = active.filter(
    (o) => o.status !== "paga" && o.status !== "pausada" && o.due_date < today,
  ).length;
  const pending = active.filter((o) => o.status !== "paga" && o.status !== "pausada").length;

  const total =
    isContinuous
      ? null
      : plan.installments_count
        ? Number(plan.installments_count)
        : active.length || null;
  const remaining = total != null ? Math.max(0, total - paid) : null;
  const progressPct = total && total > 0 ? Math.min(100, (paid / total) * 100) : null;

  const nextOcc = active
    .filter((o) => o.status !== "paga" && o.status !== "pausada")
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  const paidAmount = paidOccs.reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const launchedAmount = launchedOccs.reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const unit = Number(plan.amount ?? 0);
  const plannedAmount =
    plan.installments_count != null
      ? Number(plan.installments_count) * unit
      : active.reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const remainingAmount =
    plan.installments_count != null ? Math.max(0, plannedAmount - paidAmount) : null;

  return {
    isContinuous,
    total,
    paid,
    launched,
    open,
    notLaunched,
    remaining,
    overdue,
    pending,
    nextDueDate: nextOcc?.due_date ?? null,
    progressPct,
    paidAmount,
    launchedAmount,
    plannedAmount,
    remainingAmount,
  };
}

