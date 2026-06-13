import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Plus, ClipboardList, PauseCircle, PlayCircle, XCircle, Trash2,
  Send, ExternalLink, RotateCw, AlertTriangle, CheckCircle2, Clock,
  MoreHorizontal,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader, EmptyState } from "@/components/ui-helpers";
import { MetricCard } from "@/components/metric-card";
import { formatBRL, formatDate, getCurrentOrgId } from "@/lib/fynsinc";
import { invalidateFinanceCaches } from "@/lib/finance";
import {
  EXPENSE_TYPE_LABELS, FREQUENCY_LABELS, addFrequency, monthlyEquivalent,
  computeFirstDueDate, monthAnchor, ensureDefaultCategories, computePlanProgress,
  type ExpenseFrequency, type ExpenseType, type ExpenseOccurrenceStatus,
} from "@/lib/expenses";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/_app/despesas-planejamento")({
  component: DespesasPlanejamentoPage,
  head: () => ({ meta: [{ title: "Despesas & Planejamento — Fyn Sinc" }] }),
});

type Period = "today" | "week" | "month" | "year" | "custom";

function periodRange(period: Period, customFrom?: string, customTo?: string) {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (period === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
  if (period === "today") return { from: fmt(now), to: fmt(now) };
  if (period === "week") {
    const start = new Date(now); start.setDate(now.getDate() - 6);
    return { from: fmt(start), to: fmt(now) };
  }
  if (period === "year") {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
  }
  // month default
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: fmt(start), to: fmt(end) };
}

const planSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(120),
  description: z.string().max(500).optional(),
  expense_type: z.enum(["fixa", "variavel", "investimento"]),
  category_id: z.string().uuid().nullable(),
  amount: z.number().positive("Valor deve ser maior que zero"),
  frequency: z.enum(["unica","semanal","quinzenal","mensal","bimestral","trimestral","semestral","anual"]),
  due_day: z.number().int().min(1).max(31).nullable(),
  start_date: z.string().min(1),
  end_date: z.string().nullable(),
  default_bank_id: z.string().uuid().nullable(),
  client_id: z.string().uuid().nullable(),
  service_id: z.string().uuid().nullable(),
  notes: z.string().max(500).optional(),
  recurrence_mode: z.enum(["finite", "continuous"]).default("finite"),
  installments_count: z.number().int().min(1).nullable(),
}).refine(
  (v) =>
    v.frequency === "unica" ||
    v.recurrence_mode === "continuous" ||
    (v.installments_count != null && v.installments_count >= 1),
  { message: "Informe a quantidade de parcelas", path: ["installments_count"] },
);

function DespesasPlanejamentoPage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [tab, setTab] = useState<string>("todas");
  const [openNew, setOpenNew] = useState(false);
  const [editPlan, setEditPlan] = useState<any | null>(null);
  const [detailPlan, setDetailPlan] = useState<any | null>(null);
  const [toDelete, setToDelete] = useState<any | null>(null);

  // Seed default categories once
  useEffect(() => {
    getCurrentOrgId().then((org) => {
      if (org) ensureDefaultCategories(org).catch(() => undefined);
    });
  }, []);

  const range = useMemo(() => periodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  // ─── Queries ────────────────────────────────────────────────────────────────
  const categoriesQ = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("expense_categories")
        .select("id, name, classification, status")
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; classification: string; status: string }[];
    },
  });

  const banksQ = useQuery({
    queryKey: ["banks-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banks").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientsQ = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const servicesQ = useQuery({
    queryKey: ["services-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const plansQ = useQuery({
    queryKey: ["expense-plans"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("expense_plans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const occurrencesQ = useQuery({
    queryKey: ["expense-occurrences", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("expense_occurrences")
        .select("*")
        .gte("due_date", range.from)
        .lte("due_date", range.to)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // All occurrences (for plan detail)
  const allOccQ = useQuery({
    queryKey: ["expense-occurrences-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("expense_occurrences")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Bank balances summary for projeção (simples: usa initial_balance + soma de tx pagas)
  const bankBalanceQ = useQuery({
    queryKey: ["expense-bank-total"],
    queryFn: async () => {
      const { data: banks } = await supabase.from("banks").select("id, initial_balance");
      const { data: txs } = await supabase
        .from("financial_transactions")
        .select("type, amount_gross, status, bank_id")
        .eq("status", "pago");
      let total = (banks ?? []).reduce((s, b: any) => s + Number(b.initial_balance ?? 0), 0);
      for (const t of (txs ?? []) as any[]) {
        const v = Number(t.amount_gross ?? 0);
        if (["receita_propria", "comissao", "cashback", "repasse_recebido"].includes(t.type)) total += v;
        else if (["despesa_propria", "taxa", "uso_repasse"].includes(t.type)) total -= v;
      }
      return total;
    },
  });

  // Pending receitas in the month (for saldo esperado)
  const pendingReceitasQ = useQuery({
    queryKey: ["expense-pending-receitas", range.from, range.to],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_transactions")
        .select("amount_gross")
        .eq("type", "receita_propria")
        .eq("status", "pendente")
        .gte("due_date", range.from)
        .lte("due_date", range.to);
      return (data ?? []).reduce((s, t: any) => s + Number(t.amount_gross ?? 0), 0);
    },
  });

  // Saídas operacionais previstas (provider_payables) no período
  const providerPayablesQ = useQuery({
    queryKey: ["expense-provider-payables", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_payables")
        .select("*, providers(id, name), clients(id, name), services(id, name)")
        .gte("due_date", range.from)
        .lte("due_date", range.to)
        .neq("status", "cancelada")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // ─── Derived metrics ────────────────────────────────────────────────────────
  const plans = plansQ.data ?? [];
  const occurrences = occurrencesQ.data ?? [];
  const categories = categoriesQ.data ?? [];

  const today = new Date().toISOString().slice(0, 10);

  const enriched = useMemo(() => {
    return occurrences.map((o) => {
      const plan = plans.find((p) => p.id === o.expense_plan_id);
      const cat = plan?.category_id ? categories.find((c) => c.id === plan.category_id) : null;
      const isOverdue = o.status === "lancada" && o.due_date < today;
      const effectiveStatus: ExpenseOccurrenceStatus = isOverdue ? "vencida" : (o.status as ExpenseOccurrenceStatus);
      return { ...o, plan, category: cat, effectiveStatus };
    });
  }, [occurrences, plans, categories, today]);

  const fixedMonthlyEquiv = useMemo(() => {
    return plans
      .filter((p) => p.status === "ativo" && p.expense_type === "fixa")
      .reduce((s, p) => s + monthlyEquivalent(Number(p.amount ?? 0), p.frequency), 0);
  }, [plans]);

  const planejadoMes = enriched.reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const lancadoMes = enriched
    .filter((o) => o.status === "lancada" || o.status === "paga")
    .reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const pagoMes = enriched
    .filter((o) => o.status === "paga")
    .reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const faltaPagar = planejadoMes - pagoMes;
  const pendentesNaoPagas = enriched
    .filter((o) => o.status !== "paga" && o.status !== "cancelada" && o.status !== "pausada")
    .reduce((s, o) => s + Number(o.amount ?? 0), 0);

  const saldoAtual = bankBalanceQ.data ?? 0;
  const saldoConservador = saldoAtual - pendentesNaoPagas;
  const saldoEsperado = saldoAtual + (pendingReceitasQ.data ?? 0) - pendentesNaoPagas;

  const assinaturasAtivas = plans.filter((p) =>
    p.status === "ativo" && p.expense_type === "fixa" && p.frequency && p.frequency !== "unica"
  ).length;
  const investimentosAtivos = plans.filter((p) => p.status === "ativo" && p.expense_type === "investimento").length;

  const proximosVencimentos = enriched
    .filter((o) => o.status === "lancada" || o.status === "nao_lancada")
    .filter((o) => o.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 8);

  // Despesas por categoria
  const categoryRanking = useMemo(() => {
    const map = new Map<string, { name: string; planned: number; paid: number }>();
    for (const o of enriched) {
      const key = o.category?.id ?? "_sem";
      const name = o.category?.name ?? "Sem categoria";
      const cur = map.get(key) ?? { name, planned: 0, paid: 0 };
      cur.planned += Number(o.amount ?? 0);
      if (o.status === "paga") cur.paid += Number(o.amount ?? 0);
      map.set(key, cur);
    }
    const arr = Array.from(map.values()).sort((a, b) => b.planned - a.planned);
    const total = arr.reduce((s, x) => s + x.planned, 0) || 1;
    return arr.map((x) => ({ ...x, pct: (x.planned / total) * 100 }));
  }, [enriched]);

  const topPlanos = useMemo(() => {
    return [...plans]
      .filter((p) => p.status === "ativo")
      .sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0))
      .slice(0, 5);
  }, [plans]);

  // Progress por plano (usa TODAS as ocorrências)
  const allOcc = allOccQ.data ?? [];
  const progressByPlan = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computePlanProgress>>();
    for (const p of plans) {
      const occs = allOcc.filter((o) => o.expense_plan_id === p.id);
      map.set(p.id, computePlanProgress(p, occs, today));
    }
    return map;
  }, [plans, allOcc, today]);

  // Métricas de acompanhamento dinâmico
  const trackingMetrics = useMemo(() => {
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const in30ISO = in30.toISOString().slice(0, 10);
    let pagasMes = 0, pagasMesValor = 0;
    let restantes = 0;
    let vencidasQty = 0, vencidasValor = 0;
    let proxQty = 0, proxValor = 0;
    for (const o of allOcc) {
      if (o.status === "cancelada" || o.status === "pausada") continue;
      const amt = Number(o.amount ?? 0);
      if (o.status === "paga") {
        const ref = (o.paid_at ?? "").slice(0, 10) || o.due_date;
        if (ref >= range.from && ref <= range.to) { pagasMes++; pagasMesValor += amt; }
      } else {
        restantes++;
        if (o.due_date < today) { vencidasQty++; vencidasValor += amt; }
        else if (o.due_date <= in30ISO) { proxQty++; proxValor += amt; }
      }
    }
    return { pagasMes, pagasMesValor, restantes, vencidasQty, vencidasValor, proxQty, proxValor };
  }, [allOcc, range.from, range.to, today]);

  // Filtered list
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (tab === "todas") return true;
      if (tab === "fixas") return p.expense_type === "fixa";
      if (tab === "variaveis") return p.expense_type === "variavel";
      if (tab === "investimentos") return p.expense_type === "investimento";
      if (tab === "pausadas") return p.status === "pausado";
      if (tab === "canceladas") return p.status === "cancelado";
      const prog = progressByPlan.get(p.id);
      if (tab === "restantes") return prog && (prog.remaining ?? prog.pending) > 0;
      if (tab === "quitadas") return prog && prog.total != null && prog.remaining === 0;
      if (tab === "continuas") return prog?.isContinuous;
      // status de ocorrência → filtra planos com ao menos uma ocorrência nesse status no período
      const occs = enriched.filter((o) => o.expense_plan_id === p.id);
      if (tab === "nao_lancadas") return occs.some((o) => o.status === "nao_lancada");
      if (tab === "lancadas") return occs.some((o) => o.status === "lancada");
      if (tab === "pagas") return occs.some((o) => o.status === "paga");
      if (tab === "vencidas") return occs.some((o) => o.effectiveStatus === "vencida");
      return true;
    });
  }, [plans, tab, enriched, progressByPlan]);


  // ─── Mutations ──────────────────────────────────────────────────────────────
  const invalidateAll = () => {
    ["expense-plans","expense-occurrences","expense-occurrences-all","expense-categories",
      "expense-bank-total","expense-pending-receitas"].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] }));
    invalidateFinanceCaches(qc);
  };

  const createPlan = useMutation({
    mutationFn: async (args: { values: z.infer<typeof planSchema>; launchNow: boolean }) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Sem organização");
      const v = args.values;
      const firstDue = computeFirstDueDate(v.start_date, v.due_day);

      const isFinite = v.recurrence_mode === "finite";
      const installmentsTotal =
        v.frequency === "unica"
          ? 1
          : isFinite
            ? Math.max(1, v.installments_count ?? 1)
            : null;

      const { data: plan, error } = await (supabase as any)
        .from("expense_plans")
        .insert({
          organization_id: org,
          name: v.name,
          description: v.description || null,
          expense_type: v.expense_type,
          category_id: v.category_id,
          amount: v.amount,
          frequency: v.frequency,
          due_day: v.due_day,
          start_date: v.start_date,
          end_date: v.end_date,
          default_bank_id: v.default_bank_id,
          client_id: v.client_id,
          service_id: v.service_id,
          notes: v.notes || null,
          recurrence_mode: v.recurrence_mode,
          installments_count: installmentsTotal,
        })
        .select("*").single();
      if (error) throw error;

      // Gera todas as parcelas previstas (finite) ou apenas a primeira (continuous)
      const occurrencesToCreate = installmentsTotal ?? 1;
      let firstOcc: any = null;
      let currentDue = firstDue;
      for (let i = 0; i < occurrencesToCreate; i++) {
        const due = i === 0 ? firstDue : (currentDue = addFrequency(currentDue, v.frequency as ExpenseFrequency));
        const refMonth = monthAnchor(due);
        const { data: occ, error: occErr } = await (supabase as any)
          .from("expense_occurrences")
          .insert({
            organization_id: org,
            expense_plan_id: plan.id,
            reference_month: refMonth,
            description: plan.name,
            amount: plan.amount,
            due_date: due,
            status: "nao_lancada",
            bank_id: plan.default_bank_id,
            installment_number: i + 1,
            installments_total: installmentsTotal,
          })
          .select("*").single();
        if (occErr) {
          if (occErr.code === "23505") continue;
          throw occErr;
        }
        if (i === 0) firstOcc = occ;
      }

      if (args.launchNow && firstOcc) {
        await launchOccurrenceFn(firstOcc, plan, org);
      }
    },
    onSuccess: (_d, v) => {
      toast.success(v.launchNow ? "Despesa criada e lançada" : "Despesa salva no planejamento");
      setOpenNew(false);
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });


  const updatePlan = useMutation({
    mutationFn: async (args: { id: string; values: z.infer<typeof planSchema> }) => {
      const { error } = await (supabase as any)
        .from("expense_plans")
        .update({
          name: args.values.name,
          description: args.values.description || null,
          expense_type: args.values.expense_type,
          category_id: args.values.category_id,
          amount: args.values.amount,
          frequency: args.values.frequency,
          due_day: args.values.due_day,
          start_date: args.values.start_date,
          end_date: args.values.end_date,
          default_bank_id: args.values.default_bank_id,
          client_id: args.values.client_id,
          service_id: args.values.service_id,
          notes: args.values.notes || null,
          recurrence_mode: args.values.recurrence_mode,
          installments_count:
            args.values.frequency === "unica"
              ? 1
              : args.values.recurrence_mode === "continuous"
                ? null
                : args.values.installments_count,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Despesa atualizada"); setEditPlan(null); invalidateAll(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const setStatus = useMutation({
    mutationFn: async (args: { id: string; status: "ativo" | "pausado" | "cancelado" }) => {
      const { error } = await (supabase as any)
        .from("expense_plans")
        .update({ status: args.status })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("expense_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Despesa excluída"); setToDelete(null); invalidateAll(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  async function launchOccurrenceFn(occ: any, plan: any, orgId: string) {
    if (occ.financial_transaction_id) return;
    const { data: tx, error } = await supabase
      .from("financial_transactions")
      .insert({
        organization_id: orgId,
        type: "despesa_propria",
        status: "pendente",
        description: occ.description,
        amount_gross: occ.amount,
        amount_net: occ.amount,
        due_date: occ.due_date,
        bank_id: occ.bank_id ?? plan?.default_bank_id ?? null,
        client_id: plan?.client_id ?? null,
        service_id: plan?.service_id ?? null,
        notes: occ.notes ?? null,
        expense_occurrence_id: occ.id,
      } as any)
      .select("id").single();
    if (error) throw error;
    const { error: updErr } = await (supabase as any)
      .from("expense_occurrences")
      .update({
        financial_transaction_id: tx.id,
        status: "lancada",
        launched_at: new Date().toISOString(),
      })
      .eq("id", occ.id);
    if (updErr) throw updErr;
  }

  const launchOcc = useMutation({
    mutationFn: async (occ: any) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Sem organização");
      const plan = plans.find((p) => p.id === occ.expense_plan_id);
      await launchOccurrenceFn(occ, plan, org);
    },
    onSuccess: () => { toast.success("Lançado no Financeiro"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const launchProviderPayable = useMutation({
    mutationFn: async (p: any) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Sem organização");
      const { launchPayableInFinance } = await import("@/lib/providers");
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
      qc.invalidateQueries({ queryKey: ["expense-provider-payables"] });
      qc.invalidateQueries({ queryKey: ["provider-payables"] });
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });



  const genNext = useMutation({
    mutationFn: async (planId: string) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Sem organização");
      const plan = plans.find((p) => p.id === planId);
      if (!plan) throw new Error("Plano não encontrado");
      if (!plan.frequency || plan.frequency === "unica") throw new Error("Despesa única não tem próxima ocorrência");
      // Last occurrence
      const { data: last } = await (supabase as any)
        .from("expense_occurrences")
        .select("*")
        .eq("expense_plan_id", planId)
        .order("due_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      const baseDue = last?.due_date ?? plan.start_date;
      const nextDue = addFrequency(baseDue, plan.frequency as ExpenseFrequency);
      const refMonth = monthAnchor(nextDue);
      const { error } = await (supabase as any)
        .from("expense_occurrences")
        .insert({
          organization_id: org,
          expense_plan_id: plan.id,
          reference_month: refMonth,
          description: plan.name,
          amount: plan.amount,
          due_date: nextDue,
          status: "nao_lancada",
          bank_id: plan.default_bank_id,
        });
      if (error) {
        if (error.code === "23505") throw new Error("Já existe ocorrência neste mês");
        throw error;
      }
    },
    onSuccess: () => { toast.success("Próxima ocorrência gerada"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const genMonth = useMutation({
    mutationFn: async () => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Sem organização");
      const refMonth = monthAnchor(range.from);
      let generated = 0;
      for (const plan of plans.filter((p) => p.status === "ativo" && p.frequency && p.frequency !== "unica")) {
        const exists = (allOccQ.data ?? []).some(
          (o) => o.expense_plan_id === plan.id && o.reference_month === refMonth,
        );
        if (exists) continue;
        const due = computeFirstDueDate(`${refMonth}`, plan.due_day);
        const { error } = await (supabase as any).from("expense_occurrences").insert({
          organization_id: org,
          expense_plan_id: plan.id,
          reference_month: refMonth,
          description: plan.name,
          amount: plan.amount,
          due_date: due,
          status: "nao_lancada",
          bank_id: plan.default_bank_id,
        });
        if (!error) generated++;
      }
      return generated;
    },
    onSuccess: (n) => { toast.success(`${n} ocorrência(s) gerada(s)`); invalidateAll(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Despesas & Planejamento"
        subtitle="Controle de custos fixos, variáveis e projeção de caixa."
        actions={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => genMonth.mutate()} disabled={genMonth.isPending}>
              <RotateCw className="h-4 w-4 mr-2" />
              <span className="sm:hidden">Gerar mês</span>
              <span className="hidden sm:inline">Gerar lançamentos do mês</span>
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => setOpenNew(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nova despesa
            </Button>
          </div>
        }
      />

      {/* Filtro de período */}
      <div className="glass rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground w-full sm:w-auto">Período:</Label>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Últimos 7 dias</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="year">Este ano</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
        {period === "custom" && (
          <>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full sm:w-40" />
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full sm:w-40" />
          </>
        )}
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <MetricCard label="Fixos / mês" value={formatBRL(fixedMonthlyEquiv)} />
        <MetricCard label="Planejado" value={formatBRL(planejadoMes)} tone="primary" />
        <MetricCard label="Lançado" value={formatBRL(lancadoMes)} />
        <MetricCard label="Pago" value={formatBRL(pagoMes)} tone="success" />
        <MetricCard label="Falta pagar" value={formatBRL(faltaPagar)} tone="destructive" />
      </div>

      {/* Acompanhamento dinâmico */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Pagamentos no período" value={String(trackingMetrics.pagasMes)} hint={formatBRL(trackingMetrics.pagasMesValor)} tone="success" />
        <MetricCard label="Parcelas restantes" value={String(trackingMetrics.restantes)} />
        <MetricCard label="Vencidas" value={String(trackingMetrics.vencidasQty)} hint={formatBRL(trackingMetrics.vencidasValor)} tone="destructive" />
        <MetricCard label="Próximos 30 dias" value={String(trackingMetrics.proxQty)} hint={formatBRL(trackingMetrics.proxValor)} tone="primary" />
      </div>

      {/* Projeção de caixa — colapsável no mobile, aberta em lg+ */}
      <Accordion type="single" collapsible defaultValue="" className="lg:hidden">
        <AccordionItem value="projecao" className="glass rounded-2xl border-0 px-4">
          <AccordionTrigger className="text-sm font-semibold">Projeção de caixa</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-3 pb-2">
              <MetricCard label="Saldo conservador" value={formatBRL(saldoConservador)} hint="Bancos − pendentes" />
              <MetricCard label="Saldo esperado" value={formatBRL(saldoEsperado)} hint="+ receitas previstas" />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="hidden lg:grid grid-cols-2 gap-3">
        <MetricCard label="Saldo conservador" value={formatBRL(saldoConservador)} hint="Bancos − pendentes" />
        <MetricCard label="Saldo esperado" value={formatBRL(saldoEsperado)} hint="+ receitas previstas" />
      </div>

      {/* Métricas secundárias — colapsável no mobile */}
      <Accordion type="single" collapsible defaultValue="" className="lg:hidden">
        <AccordionItem value="metrics" className="glass rounded-2xl border-0 px-4">
          <AccordionTrigger className="text-sm font-semibold">Projeção, categorias e vencimentos</AccordionTrigger>
          <AccordionContent>
            <SecondaryMetrics
              pagoMes={pagoMes}
              planejadoMes={planejadoMes}
              faltaPagar={faltaPagar}
              assinaturasAtivas={assinaturasAtivas}
              investimentosAtivos={investimentosAtivos}
              categoryRanking={categoryRanking}
              proximosVencimentos={proximosVencimentos}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="hidden lg:grid lg:grid-cols-3 gap-4">
        <SecondaryMetrics
          pagoMes={pagoMes}
          planejadoMes={planejadoMes}
          faltaPagar={faltaPagar}
          assinaturasAtivas={assinaturasAtivas}
          investimentosAtivos={investimentosAtivos}
          categoryRanking={categoryRanking}
          proximosVencimentos={proximosVencimentos}
          inline
        />
      </div>

      {/* Top 5 */}
      {topPlanos.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3">Maiores despesas ativas</h3>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {topPlanos.map((p) => (
              <li key={p.id} className="rounded-lg border border-border/50 px-3 py-2 text-xs">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-muted-foreground truncate">{EXPENSE_TYPE_LABELS[p.expense_type as ExpenseType]} • {FREQUENCY_LABELS[p.frequency as ExpenseFrequency] ?? "—"}</div>
                <div className="font-mono mt-1">{formatBRL(Number(p.amount))}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-1 px-1 scrollbar-thin">
          <TabsList className="inline-flex w-max md:flex md:flex-wrap md:h-auto md:w-full">
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="fixas">Fixas</TabsTrigger>
            <TabsTrigger value="variaveis">Variáveis</TabsTrigger>
            <TabsTrigger value="investimentos">Investimentos</TabsTrigger>
            <TabsTrigger value="nao_lancadas">Não lançadas</TabsTrigger>
            <TabsTrigger value="lancadas">Lançadas</TabsTrigger>
            <TabsTrigger value="pagas">Pagas</TabsTrigger>
            <TabsTrigger value="vencidas">Vencidas</TabsTrigger>
            <TabsTrigger value="restantes">Com restantes</TabsTrigger>
            <TabsTrigger value="quitadas">Quitadas</TabsTrigger>
            <TabsTrigger value="continuas">Contínuas</TabsTrigger>
            <TabsTrigger value="pausadas">Pausadas</TabsTrigger>
            <TabsTrigger value="canceladas">Canceladas</TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {(providerPayablesQ.data ?? []).length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Saídas de prestadores no período</h3>
          <ul className="grid sm:grid-cols-2 gap-3">
            {(providerPayablesQ.data ?? []).map((pp: any) => {
              const launched = !!pp.financial_transaction_id;
              const status = pp.status as string;
              return (
                <li key={pp.id} className="glass rounded-2xl p-3 sm:p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{pp.description}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                        <span>Origem: Prestador</span>
                        {pp.providers?.name && <><span>·</span><span>{pp.providers.name}</span></>}
                        {pp.installment_number != null && <><span>·</span><span>Parcela {pp.installment_number}{pp.installments_total ? `/${pp.installments_total}` : ""}</span></>}
                        {pp.clients?.name && <><span>·</span><span>{pp.clients.name}</span></>}
                        {pp.services?.name && <><span>·</span><span>{pp.services.name}</span></>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Vence {formatDate(pp.due_date)} · {status}
                      </div>
                    </div>
                    <div className="font-mono font-semibold whitespace-nowrap">{formatBRL(Number(pp.amount))}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {!launched && status !== "paga" && (
                      <Button size="sm" variant="outline" onClick={() => launchProviderPayable.mutate(pp)} disabled={launchProviderPayable.isPending}>
                        <Send className="h-3.5 w-3.5 mr-1" /> Lançar no Financeiro
                      </Button>
                    )}
                    {launched && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link to="/financeiro"><ExternalLink className="h-3.5 w-3.5 mr-1" />Ver no Financeiro</Link>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/equipe-prestadores"><ExternalLink className="h-3.5 w-3.5 mr-1" />Ver prestador</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Lista */}
      {plansQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filteredPlans.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="Nenhuma despesa planejada ainda."
          description="Cadastre gastos fixos, variáveis ou investimentos para projetar melhor seu caixa."
          action={<Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-2" />Nova despesa</Button>}
        />
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {filteredPlans.map((p) => {
            const occs = enriched.filter((o) => o.expense_plan_id === p.id);
            const nextOcc = occs.find((o) => o.status === "nao_lancada" || o.status === "lancada");
            const cat = categories.find((c) => c.id === p.category_id);
            const client = clientsQ.data?.find((c: any) => c.id === p.client_id);
            const bank = banksQ.data?.find((b: any) => b.id === p.default_bank_id);
            return (
              <li key={p.id} className="glass rounded-2xl p-3 sm:p-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-3">
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setDetailPlan(p)}>
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {EXPENSE_TYPE_LABELS[p.expense_type as ExpenseType]}
                      {cat && <> • {cat.name}</>}
                      {p.frequency && <> • {FREQUENCY_LABELS[p.frequency as ExpenseFrequency]}</>}
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <div className="font-mono font-semibold">{formatBRL(Number(p.amount))}</div>
                    {p.status !== "ativo" && (
                      <span className="text-[10px] uppercase text-muted-foreground">{p.status}</span>
                    )}
                  </div>
                </div>
                {nextOcc && (
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    {nextOcc.effectiveStatus === "vencida" && <AlertTriangle className="h-3.5 w-3.5 text-[color:var(--destructive)]" />}
                    {nextOcc.status === "paga" && <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--success)]" />}
                    {nextOcc.status === "lancada" && nextOcc.effectiveStatus !== "vencida" && <Clock className="h-3.5 w-3.5 text-primary" />}
                    <span>Próx: {formatDate(nextOcc.due_date)}</span>
                    <span className="text-muted-foreground capitalize">• {nextOcc.effectiveStatus.replace("_", " ")}</span>
                  </div>
                )}
                {(bank || client) && (
                  <div className="text-xs text-muted-foreground truncate">
                    {bank && <>Banco: {bank.name}</>}
                    {bank && client && " • "}
                    {client && <>Cliente: {client.name}</>}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {nextOcc && nextOcc.status === "nao_lancada" && (
                    <Button size="sm" variant="outline" onClick={() => launchOcc.mutate(nextOcc)} disabled={launchOcc.isPending}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Lançar
                    </Button>
                  )}
                  {nextOcc?.financial_transaction_id && (
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/financeiro"><ExternalLink className="h-3.5 w-3.5 mr-1" />Ver no Financeiro</Link>
                    </Button>
                  )}
                  {p.frequency && p.frequency !== "unica" && (
                    <Button size="sm" variant="ghost" onClick={() => genNext.mutate(p.id)} disabled={genNext.isPending}>
                      <RotateCw className="h-3.5 w-3.5 mr-1" /> Próxima
                    </Button>
                  )}
                  {/* Ações secundárias: visíveis a partir de sm */}
                  <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => setEditPlan(p)}>Editar</Button>
                  {p.status === "ativo" ? (
                    <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => setStatus.mutate({ id: p.id, status: "pausado" })}>
                      <PauseCircle className="h-3.5 w-3.5 mr-1" />Pausar
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => setStatus.mutate({ id: p.id, status: "ativo" })}>
                      <PlayCircle className="h-3.5 w-3.5 mr-1" />Ativar
                    </Button>
                  )}
                  {p.status !== "cancelado" && (
                    <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => setStatus.mutate({ id: p.id, status: "cancelado" })}>
                      <XCircle className="h-3.5 w-3.5 mr-1" />Cancelar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="hidden sm:inline-flex text-[color:var(--destructive)]" onClick={() => setToDelete(p)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  {/* Menu compacto no mobile */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="sm:hidden ml-auto">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditPlan(p)}>Editar</DropdownMenuItem>
                      {p.status === "ativo" ? (
                        <DropdownMenuItem onClick={() => setStatus.mutate({ id: p.id, status: "pausado" })}>Pausar</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => setStatus.mutate({ id: p.id, status: "ativo" })}>Ativar</DropdownMenuItem>
                      )}
                      {p.status !== "cancelado" && (
                        <DropdownMenuItem onClick={() => setStatus.mutate({ id: p.id, status: "cancelado" })}>Cancelar</DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-[color:var(--destructive)]" onClick={() => setToDelete(p)}>Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Sheet Nova / Editar */}
      <PlanFormSheet
        open={openNew || !!editPlan}
        onOpenChange={(v) => { if (!v) { setOpenNew(false); setEditPlan(null); } }}
        initial={editPlan}
        categories={categories}
        banks={banksQ.data ?? []}
        clients={clientsQ.data ?? []}
        services={servicesQ.data ?? []}
        onSubmit={(values, launchNow) => {
          if (editPlan) updatePlan.mutate({ id: editPlan.id, values });
          else createPlan.mutate({ values, launchNow });
        }}
        pending={createPlan.isPending || updatePlan.isPending}
      />

      {/* Drawer detalhe */}
      <Sheet open={!!detailPlan} onOpenChange={(v) => !v && setDetailPlan(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>{detailPlan?.name}</SheetTitle></SheetHeader>
          {detailPlan && <PlanDetail plan={detailPlan} allOcc={allOccQ.data ?? []} categories={categories} banks={banksQ.data ?? []} />}
        </SheetContent>
      </Sheet>

      {/* Confirm delete */}
      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o plano e todas as ocorrências (transações no Financeiro serão desvinculadas, não removidas).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && deletePlan.mutate(toDelete.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Form Sheet ──────────────────────────────────────────────────────────────
function PlanFormSheet({
  open, onOpenChange, initial, categories, banks, clients, services, onSubmit, pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: any | null;
  categories: any[];
  banks: any[];
  clients: any[];
  services: any[];
  onSubmit: (values: z.infer<typeof planSchema>, launchNow: boolean) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expenseType, setExpenseType] = useState<ExpenseType>("fixa");
  const [categoryId, setCategoryId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [frequency, setFrequency] = useState<ExpenseFrequency>("mensal");
  const [dueDay, setDueDay] = useState<string>("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [bankId, setBankId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      if (initial) {
        setName(initial.name ?? "");
        setDescription(initial.description ?? "");
        setExpenseType((initial.expense_type as ExpenseType) ?? "fixa");
        setCategoryId(initial.category_id ?? "");
        setAmount(String(initial.amount ?? ""));
        setFrequency((initial.frequency as ExpenseFrequency) ?? "mensal");
        setDueDay(initial.due_day ? String(initial.due_day) : "");
        setStartDate(initial.start_date ?? new Date().toISOString().slice(0, 10));
        setEndDate(initial.end_date ?? "");
        setBankId(initial.default_bank_id ?? "");
        setClientId(initial.client_id ?? "");
        setServiceId(initial.service_id ?? "");
        setNotes(initial.notes ?? "");
      } else {
        setName(""); setDescription(""); setExpenseType("fixa"); setCategoryId("");
        setAmount(""); setFrequency("mensal"); setDueDay("");
        setStartDate(new Date().toISOString().slice(0, 10)); setEndDate("");
        setBankId(""); setClientId(""); setServiceId(""); setNotes("");
      }
    }
  }, [open, initial]);

  const build = (): z.infer<typeof planSchema> | null => {
    const parsed = planSchema.safeParse({
      name, description: description || undefined,
      expense_type: expenseType,
      category_id: categoryId || null,
      amount: Number(amount),
      frequency,
      due_day: dueDay ? Number(dueDay) : null,
      start_date: startDate,
      end_date: endDate || null,
      default_bank_id: bankId || null,
      client_id: clientId || null,
      service_id: serviceId || null,
      notes: notes || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return null;
    }
    return parsed.data;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>{initial ? "Editar despesa" : "Nova despesa"}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3">
          <div><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Tipo *</Label>
              <Select value={expenseType} onValueChange={(v) => setExpenseType(v as ExpenseType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixa">Fixa</SelectItem>
                  <SelectItem value="variavel">Variável</SelectItem>
                  <SelectItem value="investimento">Investimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoryId || "__none__"} onValueChange={(v) => setCategoryId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem categoria</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Valor previsto *</Label><CurrencyInput value={amount} onValueChange={setAmount} /></div>
            <div>
              <Label>Frequência *</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as ExpenseFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><Label>Dia venc.</Label><Input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></div>
            <div><Label>Início *</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><Label>Fim</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Banco padrão</Label>
              <Select value={bankId || "__none__"} onValueChange={(v) => setBankId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cliente vinculado</Label>
              <Select value={clientId || "__none__"} onValueChange={(v) => setClientId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Serviço vinculado</Label>
            <Select value={serviceId || "__none__"} onValueChange={(v) => setServiceId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>

          <div className="flex flex-col sm:flex-row gap-2 pt-3">
            {initial ? (
              <Button className="flex-1" disabled={pending} onClick={() => { const v = build(); if (v) onSubmit(v, false); }}>
                Salvar alterações
              </Button>
            ) : (
              <>
                <Button variant="outline" className="flex-1" disabled={pending} onClick={() => { const v = build(); if (v) onSubmit(v, false); }}>
                  Salvar no planejamento
                </Button>
                <Button className="flex-1" disabled={pending} onClick={() => { const v = build(); if (v) onSubmit(v, true); }}>
                  Salvar e lançar
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Plan Detail ──────────────────────────────────────────────────────────────
function PlanDetail({ plan, allOcc, categories, banks }: { plan: any; allOcc: any[]; categories: any[]; banks: any[]; }) {
  const cat = categories.find((c) => c.id === plan.category_id);
  const bank = banks.find((b) => b.id === plan.default_bank_id);
  const occs = allOcc.filter((o) => o.expense_plan_id === plan.id).sort((a, b) => b.due_date.localeCompare(a.due_date));
  const year = new Date().getFullYear();
  const yearOccs = occs.filter((o) => o.due_date.startsWith(String(year)));
  const totalPagoAno = yearOccs.filter((o) => o.status === "paga").reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const totalPrevistoAno = yearOccs.reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const proxima = occs.find((o) => o.status === "nao_lancada" || o.status === "lancada");

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><span className="text-muted-foreground">Tipo:</span> {EXPENSE_TYPE_LABELS[plan.expense_type as ExpenseType]}</div>
        <div><span className="text-muted-foreground">Categoria:</span> {cat?.name ?? "—"}</div>
        <div><span className="text-muted-foreground">Frequência:</span> {FREQUENCY_LABELS[plan.frequency as ExpenseFrequency] ?? "—"}</div>
        <div><span className="text-muted-foreground">Valor:</span> {formatBRL(Number(plan.amount))}</div>
        <div><span className="text-muted-foreground">Banco:</span> {bank?.name ?? "—"}</div>
        <div><span className="text-muted-foreground">Status:</span> {plan.status}</div>
        <div><span className="text-muted-foreground">Próx. venc.:</span> {proxima ? formatDate(proxima.due_date) : "—"}</div>
        <div><span className="text-muted-foreground">Início:</span> {formatDate(plan.start_date)}</div>
      </div>
      {plan.notes && <div className="text-xs text-muted-foreground border-l-2 pl-2">{plan.notes}</div>}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-secondary/30 p-2 text-xs">
          <div className="text-muted-foreground">Previsto no ano</div>
          <div className="font-mono">{formatBRL(totalPrevistoAno)}</div>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-xs">
          <div className="text-muted-foreground">Pago no ano</div>
          <div className="font-mono">{formatBRL(totalPagoAno)}</div>
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-2">Ocorrências ({occs.length})</h4>
        {occs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma ocorrência.</p>
        ) : (
          <ul className="space-y-1 max-h-80 overflow-y-auto">
            {occs.map((o) => (
              <li key={o.id} className="flex justify-between items-center text-xs border-b border-border/30 py-1.5">
                <div>
                  <div className="font-medium">{formatDate(o.due_date)}</div>
                  <div className="text-muted-foreground capitalize">{String(o.status).replace("_", " ")}</div>
                </div>
                <span className="font-mono">{formatBRL(Number(o.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Secondary Metrics (Previsto x Realizado / Categorias / Vencimentos) ─────
function SecondaryMetrics({
  pagoMes, planejadoMes, faltaPagar, assinaturasAtivas, investimentosAtivos,
  categoryRanking, proximosVencimentos, inline,
}: {
  pagoMes: number;
  planejadoMes: number;
  faltaPagar: number;
  assinaturasAtivas: number;
  investimentosAtivos: number;
  categoryRanking: { name: string; planned: number; paid: number; pct: number }[];
  proximosVencimentos: any[];
  inline?: boolean;
}) {
  const block = inline ? "glass rounded-2xl p-4" : "glass rounded-2xl p-3";
  const content = (
    <>
      <div className={block}>
        <h3 className="text-sm font-semibold mb-3">Previsto x Realizado</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-xs"><span>Pago</span><span>{formatBRL(pagoMes)}</span></div>
          <Progress value={planejadoMes > 0 ? (pagoMes / planejadoMes) * 100 : 0} />
          <div className="flex justify-between text-xs text-muted-foreground gap-2">
            <span className="truncate">{planejadoMes > 0 ? `${Math.round((pagoMes/planejadoMes)*100)}% consumido` : "Sem planejamento"}</span>
            <span className="shrink-0">{formatBRL(faltaPagar)} pendente</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <div><span className="text-muted-foreground">Assinaturas:</span> <strong>{assinaturasAtivas}</strong></div>
          <div><span className="text-muted-foreground">Investimentos:</span> <strong>{investimentosAtivos}</strong></div>
        </div>
      </div>
      <div className={block}>
        <h3 className="text-sm font-semibold mb-3">Despesas por categoria</h3>
        {categoryRanking.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nada no período.</p>
        ) : (
          <ul className="space-y-2 max-h-56 overflow-y-auto">
            {categoryRanking.slice(0, 6).map((c) => (
              <li key={c.name} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{c.name}</span>
                  <span className="text-muted-foreground shrink-0">{formatBRL(c.planned)} • {Math.round(c.pct)}%</span>
                </div>
                <Progress value={c.pct} className="h-1.5 mt-1" />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={block}>
        <h3 className="text-sm font-semibold mb-3">Próximos vencimentos</h3>
        {proximosVencimentos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma despesa próxima do vencimento.</p>
        ) : (
          <ul className="space-y-2 max-h-56 overflow-y-auto">
            {proximosVencimentos.map((o) => (
              <li key={o.id} className="flex justify-between items-center text-xs gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{o.description}</div>
                  <div className="text-muted-foreground">{formatDate(o.due_date)}</div>
                </div>
                <span className="font-mono shrink-0">{formatBRL(Number(o.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
  return inline ? content : <div className="space-y-3">{content}</div>;
}
