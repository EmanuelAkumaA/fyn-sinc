import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowDownCircle, ArrowUpCircle, Banknote,
  CalendarClock, Clock, Download, FileText, Filter, Gift, Mail, Pencil, Phone,
  Plus, Receipt, Repeat, ShoppingBag, Trash2, TrendingUp, Upload, Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge, EmptyState, ClientStatusBadge, FinancialStatusBadge } from "@/components/ui-helpers";
import { formatBRL, formatDate, getCurrentOrgId, RECURRENCE_LABELS } from "@/lib/fynsinc";
import { ClientLogo } from "@/components/client-logo";
import { ClientForm, type ClientRow, type ClientFormState } from "@/components/client-form";
import { getBrandColor, hexToRgba } from "@/lib/client-brand";
import { invalidateClientCaches } from "@/lib/client-cache";
import { cn } from "@/lib/utils";

export function ClientDossier({ clientId: id }: { clientId: string }) {
  return <ClienteDetalhe id={id} />;
}

type Tx = {
  id: string;
  organization_id: string;
  client_id: string | null;
  type: string;
  description: string;
  category: string | null;
  platform: string | null;
  status: string;
  amount_gross: number;
  amount_net: number | null;
  due_date: string | null;
  paid_at: string | null;
  bank_id: string | null;
  fornecedor: string | null;
  recurring_contract_id: string | null;
  created_at: string;
};

type Recurring = {
  id: string;
  client_id: string;
  service_id: string | null;
  description: string | null;
  amount: number;
  frequency: string;
  start_date: string;
  next_due_date: string;
  default_bank_id: string | null;
  status: string;
  notes: string | null;
};

type Plan = {
  id: string;
  client_id: string;
  fornecedor: string;
  plan_name: string;
  amount_received_from_client: number;
  amount_paid_to_supplier: number;
  commission_pct: number;
  commission_value: number;
  cashback_expected: number;
  cashback_received: number;
  status: string;
};

type Summary = {
  organization_id: string;
  client_id: string;
  total_received: number;
  total_receivable: number;
  total_overdue: number;
  active_recurring_amount: number;
  expected_recurring_month: number;
  pending_one_time_amount: number;
  total_repasse_received: number;
  total_repasse_used: number;
  repasse_balance: number;
  total_commissions: number;
  total_cashbacks: number;
  total_fees: number;
  total_expenses: number;
  client_net_profit: number;
};

type DocRow = {
  id: string;
  organization_id: string;
  client_id: string;
  document_type: string;
  title: string;
  description: string | null;
  file_url: string;
  file_path: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  related_transaction_id: string | null;
  document_date: string | null;
  created_at: string;
};

type Bank = { id: string; name: string };

const DOC_TYPES: { value: string; label: string }[] = [
  { value: "contrato", label: "Contrato" },
  { value: "comprovante_pagamento", label: "Comprovante de pagamento" },
  { value: "nota_fiscal", label: "Nota fiscal" },
  { value: "recibo", label: "Recibo" },
  { value: "proposta", label: "Proposta" },
  { value: "comprovante_aporte", label: "Comprovante de aporte" },
  { value: "comprovante_compra", label: "Comprovante de compra" },
  { value: "print", label: "Print" },
  { value: "outro", label: "Outro" },
];

function ClienteDetalhe({ id }: { id: string }) {
  const qc = useQueryClient();

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as ClientRow | null;
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["client-summary", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_client_financial_summary" as never)
        .select("*")
        .eq("client_id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Summary | null;
    },
  });

  const { data: tx = [] } = useQuery({
    queryKey: ["client-transactions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .eq("client_id", id)
        .order("due_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Tx[];
    },
  });

  const { data: recurring = [] } = useQuery({
    queryKey: ["client-recurring", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_contracts")
        .select("*")
        .eq("client_id", id)
        .order("next_due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Recurring[];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["client-plans", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("third_party_plans").select("*").eq("client_id", id);
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["client-documents", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["banks-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banks").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as Bank[];
    },
  });

  const [editOpen, setEditOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const range = useMemo(() => getPeriodRange(period, customStart, customEnd), [period, customStart, customEnd]);
  const periodTotals = useMemo(() => computePeriodTotals(tx, range.start, range.end), [tx, range]);

  const updateClient = useMutation({
    mutationFn: async (data: ClientFormState) => {
      const payload = {
        ...data,
        logo_url: data.logo_url.trim() || null,
        brand_color: data.brand_color.trim() || null,
      };
      const { error } = await supabase.from("clients").update(payload as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente atualizado");
      invalidateClientCaches(qc, id);
      setEditOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateNotes = useMutation({
    mutationFn: async (notes: string) => {
      const { error } = await supabase.from("clients").update({ notes } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Observações atualizadas");
      invalidateClientCaches(qc, id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!client) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  const color = getBrandColor(client);
  const style = {
    "--client-color": color,
    "--client-glow": hexToRgba(color, 0.22),
    "--client-tint": hexToRgba(color, 0.08),
  } as CSSProperties;

  const inadimplente = (client.financial_status ?? (client.status === "inadimplente" ? "inadimplente" : "em_dia")) === "inadimplente";

  return (
    <>

      <header className="client-header p-5 md:p-6 mb-6" style={style}>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <ClientLogo client={client} size="lg" glow />
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl md:text-3xl font-bold truncate">{client.name}</h1>
            <p className="text-sm text-muted-foreground">
              {client.type}{client.document && ` · ${client.document}`}
              {client.company && ` · ${client.company}`}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {client.phone && (
                <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {client.phone}</span>
              )}
              {client.email && (
                <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {client.email}</span>
              )}
            </div>
          </div>
          <div className="shrink-0 flex flex-col md:items-end gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <ClientStatusBadge value={client.client_status ?? client.status} />
              <FinancialStatusBadge value={client.financial_status} />
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Editar cliente
            </Button>
          </div>
        </div>
      </header>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar cliente</SheetTitle>
          </SheetHeader>
          <ClientForm
            initial={client}
            onSubmit={(data) => updateClient.mutate(data)}
            loading={updateClient.isPending}
            submitLabel="Salvar alterações"
          />
        </SheetContent>
      </Sheet>

      {inadimplente && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[color:var(--destructive)]/30 bg-[color:var(--destructive)]/10 px-4 py-2.5 text-sm text-[color:var(--destructive)]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Cliente com valores em atraso.</span>
        </div>
      )}

      <MainMetrics totals={periodTotals} repasseBalance={summary?.repasse_balance ?? 0} />
      <ClientSummaryBlock
        summary={summary}
        tx={tx}
        recurring={recurring}
        financialStatus={client.financial_status ?? client.status}
        range={range}
        period={period}
      />

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="bg-secondary/40 mb-4 overflow-x-auto justify-start whitespace-nowrap">
          <TabsTrigger value="overview" className="whitespace-nowrap">Visão geral</TabsTrigger>
          <TabsTrigger value="financeiro" className="whitespace-nowrap">Financeiro</TabsTrigger>
          <TabsTrigger value="aportes" className="whitespace-nowrap">Aportes</TabsTrigger>
          <TabsTrigger value="arquivos" className="whitespace-nowrap">Arquivos</TabsTrigger>
          <TabsTrigger value="timeline" className="whitespace-nowrap">Timeline</TabsTrigger>
          <TabsTrigger value="observacoes" className="whitespace-nowrap">Observações</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            tx={tx}
            recurring={recurring}
            inadimplente={inadimplente}
            period={period}
            setPeriod={setPeriod}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
            range={range}
          />
        </TabsContent>
        <TabsContent value="financeiro">
          <FinanceiroTab tx={tx} banks={banks} />
        </TabsContent>
        <TabsContent value="aportes">
          <AportesTab tx={tx} summary={summary} />
        </TabsContent>
        <TabsContent value="arquivos">
          <ArquivosTab clientId={id} orgId={(client as ClientRow & { organization_id?: string }).organization_id ?? null} docs={docs} tx={tx} />
        </TabsContent>
        <TabsContent value="timeline">
          <TimelineTab tx={tx} recurring={recurring} docs={docs} clientCreatedAt={(client as ClientRow & { created_at?: string }).created_at} />
        </TabsContent>
        <TabsContent value="observacoes">
          <ObservacoesTab notes={client.notes} onSave={(v) => updateNotes.mutate(v)} saving={updateNotes.isPending} />
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ----------------------------- PERIOD HELPERS ----------------------------- */

type Period = "today" | "week" | "month" | "year" | "all" | "custom";
type Range = { start: string | null; end: string | null };

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoje",
  week: "Semana",
  month: "Mês",
  year: "Ano",
  all: "Todo o histórico",
  custom: "Personalizado",
};

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getPeriodRange(period: Period, customStart?: string, customEnd?: string): Range {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (period) {
    case "today": { const t = isoDate(new Date(y, m, d)); return { start: t, end: t }; }
    case "week": {
      const day = now.getDay();
      return { start: isoDate(new Date(y, m, d - day)), end: isoDate(new Date(y, m, d - day + 6)) };
    }
    case "month": return { start: isoDate(new Date(y, m, 1)), end: isoDate(new Date(y, m + 1, 0)) };
    case "year": return { start: isoDate(new Date(y, 0, 1)), end: isoDate(new Date(y, 11, 31)) };
    case "all": return { start: null, end: null };
    case "custom": return { start: customStart || null, end: customEnd || null };
  }
}

function getPreviousPeriod(range: Range): Range {
  if (!range.start || !range.end) return { start: null, end: null };
  const s = new Date(range.start + "T00:00:00");
  const e = new Date(range.end + "T00:00:00");
  const dayMs = 86400000;
  const days = Math.round((e.getTime() - s.getTime()) / dayMs) + 1;
  const prevEnd = new Date(s.getTime() - dayMs);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * dayMs);
  return { start: isoDate(prevStart), end: isoDate(prevEnd) };
}

function inRange(date: string | null | undefined, range: Range): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  if (!range.start && !range.end) return true;
  if (range.start && d < range.start) return false;
  if (range.end && d > range.end) return false;
  return true;
}

type PeriodTotals = {
  received: number;
  receivable: number;
  overdue: number;
  profit: number;
  fees: number;
  ownExpenses: number;
  repasseRec: number;
  repasseUso: number;
};

function computePeriodTotals(tx: Tx[], rangeStart: string | null, rangeEnd: string | null): PeriodTotals {
  const range: Range = { start: rangeStart, end: rangeEnd };
  const today = isoDate(new Date());
  let received = 0, receivable = 0, overdue = 0, fees = 0, ownExpenses = 0, repasseRec = 0, repasseUso = 0;
  for (const t of tx) {
    const g = Number(t.amount_gross);
    if (t.status === "pago" && inRange(t.paid_at, range)) {
      if (t.type === "receita_propria" || t.type === "comissao" || t.type === "cashback") received += g;
      if (t.type === "taxa") fees += g;
      if (t.type === "despesa_propria") ownExpenses += g;
      if (t.type === "repasse_recebido") repasseRec += g;
      if (t.type === "uso_repasse") repasseUso += g;
    }
    if (t.type === "receita_propria" && t.status === "pendente" && t.due_date) {
      const dd = t.due_date;
      if (dd >= today && inRange(dd, range)) receivable += g;
      const upper = range.end ?? today;
      const lowerOk = !range.start || dd >= range.start;
      if (dd < today && dd <= upper && lowerOk) overdue += g;
    }
  }
  return { received, receivable, overdue, profit: received - fees - ownExpenses, fees, ownExpenses, repasseRec, repasseUso };
}

function formatRange(range: Range): string {
  if (!range.start || !range.end) return "todo o histórico";
  return `${formatDate(range.start)} – ${formatDate(range.end)}`;
}

/* ----------------------------- MAIN METRICS ----------------------------- */

type Tone = "success" | "destructive" | "primary";

function MainMetrics({ totals, repasseBalance }: { totals: PeriodTotals; repasseBalance: number }) {
  type Card = { label: string; value: number; tone?: Tone; icon: React.ComponentType<{ className?: string }> };
  const cards: Card[] = [
    { label: "Já pagou", value: totals.received, tone: "success", icon: TrendingUp },
    { label: "Total a receber", value: totals.receivable, icon: CalendarClock },
    { label: "Em atraso", value: totals.overdue, tone: "destructive", icon: AlertTriangle },
    { label: "Saldo de aporte", value: repasseBalance, tone: "primary", icon: Wallet },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => <MetricBig key={c.label} {...c} />)}
    </div>
  );
}

function MetricBig({ label, value, tone, icon: Icon }: { label: string; value: number; tone?: Tone; icon: React.ComponentType<{ className?: string }> }) {
  const toneCls =
    tone === "success" ? "text-[color:var(--success)]" :
    tone === "destructive" ? "text-[color:var(--destructive)]" :
    tone === "primary" ? "text-primary" : "";
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <div className="h-9 w-9 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={cn("font-display text-2xl md:text-3xl font-bold mt-2 tracking-tight", toneCls)}>
        {formatBRL(value)}
      </div>
    </div>
  );
}

/* ----------------------------- CLIENT SUMMARY BLOCK ----------------------------- */

function ClientSummaryBlock({ summary, tx, recurring, financialStatus, range, period }: {
  summary: Summary | null | undefined;
  tx: Tx[];
  recurring: Recurring[];
  financialStatus: string | null | undefined;
  range: Range;
  period: Period;
}) {
  const ativas = recurring.filter((r) => r.status === "ativo");
  const proxVenc = ativas
    .map((r) => r.next_due_date)
    .filter((d): d is string => !!d && inRange(d, range))
    .sort()[0] ?? null;

  const ultimaMov = [...tx]
    .filter((t) => inRange(t.created_at, range))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

  const ultimoPag = [...tx]
    .filter((t) => t.status === "pago" && t.paid_at && inRange(t.paid_at, range))
    .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""))[0] ?? null;

  const previstoPeriodo = period === "month"
    ? (summary?.expected_recurring_month ?? 0)
    : ativas
        .filter((r) => inRange(r.next_due_date, range))
        .reduce((s, r) => s + Number(r.amount), 0);

  const muted = (txt: string) => <span className="text-muted-foreground">{txt}</span>;

  const items: { label: string; value: React.ReactNode }[] = [
    {
      label: "Mensalidade ativa",
      value: ativas.length > 0
        ? <span className="text-primary font-semibold">{formatBRL(summary?.active_recurring_amount ?? ativas.reduce((s, r) => s + Number(r.amount), 0))}</span>
        : muted("Nenhuma mensalidade ativa"),
    },
    {
      label: "Próximo vencimento",
      value: proxVenc ? formatDate(proxVenc) : muted("Sem vencimentos neste período"),
    },
    {
      label: "Previsto no período",
      value: previstoPeriodo > 0 ? formatBRL(previstoPeriodo) : muted("Sem previsão para o período"),
    },
    {
      label: "Última movimentação",
      value: ultimaMov
        ? <span className="truncate">{ultimaMov.description} — {formatDate(ultimaMov.created_at)}</span>
        : muted("Nenhuma movimentação no período"),
    },
    {
      label: "Último pagamento",
      value: ultimoPag
        ? <span>{formatBRL(Number(ultimoPag.amount_gross))} em {formatDate(ultimoPag.paid_at)}</span>
        : muted("Nenhum pagamento registrado"),
    },
    {
      label: "Status financeiro",
      value: <FinancialStatusBadge value={financialStatus} />,
    },
  ];

  return (
    <div className="glass rounded-2xl p-4 md:p-5 mt-3">
      <h3 className="font-display font-semibold mb-3">Resumo do cliente</h3>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {items.map((it) => (
          <li key={it.label} className="flex items-center justify-between gap-3 py-1 border-b border-border/30 last:border-0 md:[&:nth-last-child(2)]:border-0">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">{it.label}</span>
            <span className="font-medium text-right min-w-0 truncate">{it.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


/* ----------------------------- OVERVIEW ----------------------------- */

function OverviewTab({ tx, recurring, inadimplente, period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd, range }: {
  tx: Tx[]; recurring: Recurring[]; inadimplente: boolean;
  period: Period; setPeriod: (p: Period) => void;
  customStart: string; setCustomStart: (s: string) => void;
  customEnd: string; setCustomEnd: (s: string) => void;
  range: Range;
}) {
  void inadimplente;
  const [compareOpen, setCompareOpen] = useState(false);
  const today = isoDate(new Date());
  const upperEnd = range.end ?? "9999-12-31";

  const upcoming = tx
    .filter((t) => t.type === "receita_propria" && t.status === "pendente" && t.due_date && t.due_date >= today && t.due_date <= upperEnd && (!range.start || t.due_date >= range.start))
    .slice(0, 5);
  const latest = [...tx]
    .filter((t) => inRange(t.created_at, range))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
  const ativas = recurring.filter((r) => r.status === "ativo");

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-3 flex flex-col md:flex-row md:items-center gap-2">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground ml-1" />
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {period === "custom" && (
            <>
              <Input type="date" className="w-40" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <span className="text-xs text-muted-foreground">até</span>
              <Input type="date" className="w-40" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </>
          )}
          <span className="text-xs text-muted-foreground ml-1 hidden md:inline">{formatRange(range)}</span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCompareOpen(true)}>
          <TrendingUp className="h-3.5 w-3.5" /> Comparar período
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card title="Próximos vencimentos">
          {upcoming.length === 0 ? <Empty>Sem vencimentos próximos.</Empty> : (
            <ul className="divide-y divide-border/50">
              {upcoming.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.description}</div>
                    <div className="text-xs text-muted-foreground">vence {formatDate(t.due_date)}</div>
                  </div>
                  <span className="font-display font-semibold">{formatBRL(Number(t.amount_gross))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Últimas movimentações">
          {latest.length === 0 ? <Empty>Nenhuma movimentação no período.</Empty> : (
            <ul className="divide-y divide-border/50">
              {latest.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.description}</div>
                    <div className="text-xs text-muted-foreground capitalize">{t.type.replace(/_/g, " ")} · {formatDate(t.due_date ?? t.paid_at)}</div>
                  </div>
                  <span className={cn("font-display font-semibold", incomeTypes.has(t.type) ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]")}>
                    {formatBRL(Number(t.amount_gross))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {ativas.length > 0 && (
          <Card title="Mensalidades ativas">
            <ul className="divide-y divide-border/50">
              {ativas.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.description ?? "Mensalidade"}</div>
                    <div className="text-xs text-muted-foreground">
                      {RECURRENCE_LABELS[r.frequency as keyof typeof RECURRENCE_LABELS] ?? r.frequency} · próximo {formatDate(r.next_due_date)}
                    </div>
                  </div>
                  <span className="font-display font-semibold text-primary">{formatBRL(Number(r.amount))}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <ComparePeriodSheet open={compareOpen} onOpenChange={setCompareOpen} tx={tx} range={range} />
    </div>
  );
}

const incomeTypes = new Set(["receita_propria", "comissao", "cashback", "repasse_recebido"]);

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground py-2">{children}</p>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  const cls =
    tone === "success" ? "text-[color:var(--success)]" :
    tone === "destructive" ? "text-[color:var(--destructive)]" :
    tone === "primary" ? "text-primary" : "";
  return (
    <div className="rounded-lg bg-secondary/30 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("font-display font-bold text-base mt-0.5", cls)}>{value}</div>
    </div>
  );
}

/* ----------------------------- FINANCEIRO ----------------------------- */

function FinanceiroTab({ tx, banks }: { tx: Tx[]; banks: Bank[] }) {
  const [typeF, setTypeF] = useState("todos");
  const [statusF, setStatusF] = useState("todos");
  const [bankF, setBankF] = useState("todos");
  const [period, setPeriod] = useState<"30" | "90" | "365" | "all">("all");

  const bankName = (bid: string | null) => banks.find((b) => b.id === bid)?.name ?? "—";

  const filtered = useMemo(() => {
    const now = new Date();
    const days = period === "all" ? null : Number(period);
    const cutoff = days ? new Date(now.getTime() - days * 86400000) : null;
    return tx.filter((t) => {
      if (typeF !== "todos" && t.type !== typeF) return false;
      if (statusF !== "todos" && t.status !== statusF) return false;
      if (bankF !== "todos" && t.bank_id !== bankF) return false;
      if (cutoff) {
        const ref = new Date(t.due_date ?? t.paid_at ?? t.created_at);
        if (ref < cutoff) return false;
      }
      return true;
    });
  }, [tx, typeF, statusF, bankF, period]);

  return (
    <div>
      <div className="glass rounded-2xl p-3 mb-3 flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground ml-1" />
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
            <SelectItem value="all">Todo período</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeF} onValueChange={setTypeF}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {["receita_propria","despesa_propria","repasse_recebido","uso_repasse","comissao","cashback","taxa","transferencia"].map((t) => (
              <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {["pendente","pago","atrasado","cancelado"].map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={bankF} onValueChange={setBankF}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Banco" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os bancos</SelectItem>
            {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Receipt className="h-6 w-6" />} title="Sem lançamentos" description="Nenhum lançamento corresponde aos filtros." />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div key={t.id} className="glass rounded-xl p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{t.description}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {t.type.replace(/_/g, " ")} · {formatDate(t.due_date ?? t.paid_at)} · {bankName(t.bank_id)}
                  {t.category && ` · ${t.category}`}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className={cn("font-display font-semibold text-sm", incomeTypes.has(t.type) ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]")}>
                    {formatBRL(Number(t.amount_gross))}
                  </div>
                  {t.amount_net != null && Number(t.amount_net) !== Number(t.amount_gross) && (
                    <div className="text-[10px] text-muted-foreground">líq. {formatBRL(Number(t.amount_net))}</div>
                  )}
                </div>
                <StatusBadge status={t.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- MENSALIDADES ----------------------------- */

function MensalidadesTab({ recurring, clientId }: { recurring: Recurring[]; clientId: string }) {
  const qc = useQueryClient();

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("recurring_contracts").update({ status } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      invalidateClientCaches(qc, clientId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (recurring.length === 0) {
    return <EmptyState icon={<Repeat className="h-6 w-6" />} title="Sem mensalidades" description="Cadastre uma recorrência em Recorrências para vincular ao cliente." />;
  }

  return (
    <div className="grid gap-3">
      {recurring.map((r) => (
        <div key={r.id} className="glass rounded-2xl p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium truncate">{r.description ?? "Mensalidade"}</h4>
                <StatusBadge status={r.status} />
              </div>
              <div className="text-xs text-muted-foreground">
                {RECURRENCE_LABELS[r.frequency as keyof typeof RECURRENCE_LABELS] ?? r.frequency} · próximo vencimento {formatDate(r.next_due_date)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display font-bold text-lg text-primary">{formatBRL(Number(r.amount))}</div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleStatus.mutate({ id: r.id, status: r.status === "ativo" ? "pausado" : "ativo" })}
              >
                {r.status === "ativo" ? "Pausar" : "Ativar"}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- APORTES ----------------------------- */

function AportesTab({ tx, summary }: { tx: Tx[]; summary: Summary | null | undefined }) {
  const aportes = tx.filter((t) => ["repasse_recebido", "uso_repasse"].includes(t.type));
  const byPlatform = new Map<string, { rec: number; uso: number }>();
  aportes.forEach((t) => {
    const k = t.platform || "Sem plataforma";
    const e = byPlatform.get(k) || { rec: 0, uso: 0 };
    if (t.type === "repasse_recebido") e.rec += Number(t.amount_gross);
    else e.uso += Number(t.amount_gross);
    byPlatform.set(k, e);
  });

  if (aportes.length === 0) {
    return <EmptyState icon={<Wallet className="h-6 w-6" />} title="Sem aportes" description="Repasses recebidos e usos aparecerão aqui." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="Total aportado" value={formatBRL(summary?.total_repasse_received ?? 0)} tone="success" />
        <Stat label="Total utilizado" value={formatBRL(summary?.total_repasse_used ?? 0)} tone="destructive" />
        <Stat label="Saldo disponível" value={formatBRL(summary?.repasse_balance ?? 0)} tone="primary" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...byPlatform.entries()].map(([plat, v]) => (
          <div key={plat} className="glass rounded-2xl p-4">
            <div className="text-xs uppercase text-muted-foreground">{plat}</div>
            <div className="font-display text-xl font-bold mt-1 text-primary">{formatBRL(v.rec - v.uso)}</div>
            <div className="text-xs text-muted-foreground">recebido {formatBRL(v.rec)} · usado {formatBRL(v.uso)}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {aportes.map((t) => (
          <div key={t.id} className="glass rounded-xl p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{t.description}</div>
              <div className="text-xs text-muted-foreground">
                {t.type === "repasse_recebido" ? "Aporte recebido" : "Uso de aporte"}
                {t.platform && ` · ${t.platform}`}
                {t.fornecedor && ` · ${t.fornecedor}`}
                {` · ${formatDate(t.due_date ?? t.paid_at)}`}
              </div>
            </div>
            <span className={cn("font-display font-semibold", t.type === "repasse_recebido" ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]")}>
              {formatBRL(Number(t.amount_gross))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- PLANOS ----------------------------- */

function PlanosTab({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="h-6 w-6" />}
        title="Nenhum plano/ferramenta vinculado a este cliente."
        description="Cadastre planos e ferramentas pagas em nome do cliente para acompanhar comissões e cashbacks."
      />
    );
  }
  return (
    <div className="grid gap-3">
      {plans.map((p) => (
        <div key={p.id} className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="font-medium">{p.plan_name} <span className="text-muted-foreground text-sm">· {p.fornecedor}</span></div>
            <StatusBadge status={p.status} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground mt-2">
            <div>Cliente: <span className="text-foreground font-medium">{formatBRL(Number(p.amount_received_from_client))}</span></div>
            <div>Fornecedor: <span className="text-foreground font-medium">{formatBRL(Number(p.amount_paid_to_supplier))}</span></div>
            <div>Comissão {Number(p.commission_pct).toFixed(0)}%: <span className="text-[color:var(--success)] font-medium">{formatBRL(Number(p.commission_value))}</span></div>
            <div>Cashback: <span className="text-[color:var(--success)] font-medium">{formatBRL(Number(p.cashback_received))} / {formatBRL(Number(p.cashback_expected))}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- ARQUIVOS ----------------------------- */

function ArquivosTab({ clientId, orgId, docs, tx }: {
  clientId: string; orgId: string | null; docs: DocRow[]; tx: Tx[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const remove = useMutation({
    mutationFn: async (d: DocRow) => {
      await supabase.storage.from("client-documents").remove([d.file_path]);
      const { error } = await supabase.from("client_documents").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento removido");
      invalidateClientCaches(qc, clientId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = async (d: DocRow) => {
    const { data, error } = await supabase.storage.from("client-documents").createSignedUrl(d.file_path, 60);
    if (error || !data) { toast.error("Falha ao gerar link"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{docs.length} documento(s) anexado(s).</p>
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)} style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
          <Plus className="h-4 w-4" /> Anexar documento
        </Button>
      </div>

      <UploadDialog open={open} onOpenChange={setOpen} clientId={clientId} orgId={orgId} tx={tx} />

      {docs.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="Nenhum arquivo" description="Anexe contratos, comprovantes, notas fiscais e propostas." />
      ) : (
        <div className="grid gap-2">
          {docs.map((d) => (
            <div key={d.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{d.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {(DOC_TYPES.find((t) => t.value === d.document_type)?.label) ?? d.document_type}
                  {d.document_date && ` · ${formatDate(d.document_date)}`}
                  {d.file_name && ` · ${d.file_name}`}
                </div>
                {d.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{d.description}</div>}
              </div>
              <div className="flex gap-1.5">
                <Button size="icon" variant="ghost" onClick={() => download(d)} title="Baixar"><Download className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(d)} title="Excluir" className="text-[color:var(--destructive)]"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadDialog({ open, onOpenChange, clientId, orgId, tx }: {
  open: boolean; onOpenChange: (v: boolean) => void; clientId: string; orgId: string | null; tx: Tx[];
}) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<string>("contrato");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [relatedTx, setRelatedTx] = useState<string>("nenhum");
  const [busy, setBusy] = useState(false);

  const reset = () => { setFile(null); setTitle(""); setDocType("contrato"); setDescription(""); setDate(""); setRelatedTx("nenhum"); };

  const submit = async () => {
    if (!file) { toast.error("Selecione um arquivo"); return; }
    if (!title.trim()) { toast.error("Informe um título"); return; }
    setBusy(true);
    try {
      const org = orgId ?? (await getCurrentOrgId());
      if (!org) throw new Error("Organização não encontrada");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${org}/${clientId}/${Date.now()}-${safeName}`;
      const up = await supabase.storage.from("client-documents").upload(path, file, { upsert: false, contentType: file.type });
      if (up.error) throw up.error;
      const { data: signed } = await supabase.storage.from("client-documents").createSignedUrl(path, 60);

      const { error } = await supabase.from("client_documents").insert({
        organization_id: org,
        client_id: clientId,
        document_type: docType,
        title: title.trim(),
        description: description.trim() || null,
        file_url: signed?.signedUrl ?? path,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        related_transaction_id: relatedTx === "nenhum" ? null : relatedTx,
        document_date: date || null,
      } as never);
      if (error) throw error;
      toast.success("Documento anexado");
      invalidateClientCaches(qc, clientId);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Anexar documento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Arquivo</Label>
            <label className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 cursor-pointer text-sm text-muted-foreground hover:bg-secondary/30">
              <Upload className="h-4 w-4" />
              <span className="truncate">{file?.name ?? "Selecione um arquivo"}</span>
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Vincular a lançamento</Label>
            <Select value={relatedTx} onValueChange={setRelatedTx}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhum</SelectItem>
                {tx.slice(0, 50).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {formatDate(t.due_date ?? t.paid_at)} · {t.description.slice(0, 40)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
            {busy ? "Enviando..." : "Anexar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- TIMELINE ----------------------------- */

type TimelineItem = { date: string; title: string; description?: string; icon: React.ComponentType<{ className?: string }>; tone?: Tone };

function TimelineTab({ tx, recurring, docs, clientCreatedAt }: {
  tx: Tx[]; recurring: Recurring[]; docs: DocRow[]; clientCreatedAt?: string;
}) {
  const items: TimelineItem[] = [];
  if (clientCreatedAt) {
    items.push({ date: clientCreatedAt, title: "Cliente criado", icon: Plus, tone: "primary" });
  }
  tx.forEach((t) => {
    const date = t.paid_at ?? t.due_date ?? t.created_at;
    const isPaid = t.status === "pago";
    const verb = isPaid ? "pago" : (t.status === "pendente" ? "criado pendente" : t.status);
    items.push({
      date,
      title: `${labelType(t.type)} ${verb} · ${formatBRL(Number(t.amount_gross))}`,
      description: t.description,
      icon: incomeTypes.has(t.type) ? ArrowDownCircle : ArrowUpCircle,
      tone: incomeTypes.has(t.type) ? "success" : "destructive",
    });
  });
  recurring.forEach((r) => {
    items.push({
      date: r.start_date,
      title: `Mensalidade criada · ${formatBRL(Number(r.amount))}`,
      description: r.description ?? undefined,
      icon: Repeat,
      tone: "primary",
    });
  });
  docs.forEach((d) => {
    items.push({
      date: d.document_date ?? d.created_at,
      title: `Documento anexado · ${d.title}`,
      description: DOC_TYPES.find((t) => t.value === d.document_type)?.label,
      icon: FileText,
    });
  });

  items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  if (items.length === 0) {
    return <EmptyState icon={<Clock className="h-6 w-6" />} title="Sem eventos" description="A timeline mostrará lançamentos, documentos e mudanças do cliente." />;
  }

  return (
    <div className="relative pl-5">
      <div className="absolute left-1.5 top-2 bottom-2 w-px bg-border/60" aria-hidden />
      <ul className="space-y-3">
        {items.map((it, i) => {
          const Icon = it.icon;
          const dot =
            it.tone === "success" ? "bg-[color:var(--success)]" :
            it.tone === "destructive" ? "bg-[color:var(--destructive)]" :
            it.tone === "primary" ? "bg-primary" : "bg-muted-foreground";
          return (
            <li key={i} className="relative">
              <span className={cn("absolute -left-[18px] top-2 h-2.5 w-2.5 rounded-full ring-4 ring-background", dot)} aria-hidden />
              <div className="glass rounded-xl p-3 flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{it.title}</div>
                  {it.description && <div className="text-xs text-muted-foreground truncate">{it.description}</div>}
                  <div className="text-[11px] text-muted-foreground mt-0.5">{formatDate(it.date)}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function labelType(t: string) {
  const map: Record<string, string> = {
    receita_propria: "Receita",
    despesa_propria: "Despesa",
    repasse_recebido: "Repasse recebido",
    uso_repasse: "Uso de repasse",
    comissao: "Comissão",
    cashback: "Cashback",
    taxa: "Taxa",
    transferencia: "Transferência",
  };
  return map[t] ?? t;
}

/* ----------------------------- OBSERVAÇÕES ----------------------------- */

function ObservacoesTab({ notes, onSave, saving }: { notes: string | null | undefined; onSave: (v: string) => void; saving: boolean }) {
  const [value, setValue] = useState(notes ?? "");
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold">Observações internas</h3>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setValue(notes ?? ""); setEditing(true); }}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        </div>
        {notes ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Nenhuma observação registrada.</p>
        )}
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <h3 className="font-display font-semibold">Observações internas</h3>
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={6} />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
        <Button
          onClick={() => { onSave(value); setEditing(false); }}
          disabled={saving}
          style={{ background: "var(--gradient-primary)", color: "var(--background)" }}
        >
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------- COMPARE PERIOD SHEET ----------------------------- */

function ComparePeriodSheet({ open, onOpenChange, tx, range }: {
  open: boolean; onOpenChange: (o: boolean) => void; tx: Tx[]; range: Range;
}) {
  const prev = useMemo(() => getPreviousPeriod(range), [range]);
  const current = useMemo(() => computePeriodTotals(tx, range.start, range.end), [tx, range]);
  const previous = useMemo(() => computePeriodTotals(tx, prev.start, prev.end), [tx, prev]);

  const metrics: { key: string; label: string; current: number; previous: number; inverse?: boolean }[] = [
    { key: "rec", label: "Recebido", current: current.received, previous: previous.received },
    { key: "lucro", label: "Lucro estimado", current: current.profit, previous: previous.profit },
    { key: "areceber", label: "A receber", current: current.receivable, previous: previous.receivable },
    { key: "atraso", label: "Em atraso", current: current.overdue, previous: previous.overdue, inverse: true },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Comparação de período</SheetTitle>
        </SheetHeader>
        <p className="text-xs text-muted-foreground mt-1">
          Atual: {formatRange(range)} · Anterior: {formatRange(prev)}
        </p>

        <div className="grid grid-cols-2 gap-2 mt-4">
          {metrics.map((m) => <CompareCard key={m.key} {...m} />)}
        </div>

        <div className="mt-5 space-y-3">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Comparativo visual</h4>
          {["rec", "lucro", "atraso"].map((k) => {
            const m = metrics.find((x) => x.key === k)!;
            const max = Math.max(m.current, m.previous, 1);
            return (
              <div key={k} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="text-muted-foreground">máx {formatBRL(max)}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary/40 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(m.current / max) * 100}%` }} />
                </div>
                <div className="h-2 rounded-full bg-secondary/40 overflow-hidden">
                  <div className="h-full bg-primary/40" style={{ width: `${(m.previous / max) * 100}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Atual {formatBRL(m.current)}</span>
                  <span>Anterior {formatBRL(m.previous)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 glass rounded-xl p-3 text-xs">
          <div className="text-muted-foreground uppercase tracking-wider mb-1">Movimentação de aporte no período</div>
          <div className="flex justify-between"><span>Aportes recebidos</span><span className="text-[color:var(--success)] font-medium">{formatBRL(current.repasseRec)}</span></div>
          <div className="flex justify-between"><span>Aportes utilizados</span><span className="text-[color:var(--destructive)] font-medium">{formatBRL(current.repasseUso)}</span></div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CompareCard({ label, current, previous, inverse }: { label: string; current: number; previous: number; inverse?: boolean }) {
  const diff = current - previous;
  const pct = previous === 0 ? (current === 0 ? 0 : 100) : (diff / Math.abs(previous)) * 100;
  const up = diff > 0;
  const flat = diff === 0;
  const good = flat ? null : (inverse ? !up : up);
  const cls = good == null ? "text-muted-foreground" : good ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]";
  const arrow = flat ? "—" : up ? "▲" : "▼";
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-bold mt-1">{formatBRL(current)}</div>
      <div className="text-[11px] text-muted-foreground">anterior {formatBRL(previous)}</div>
      <div className={cn("text-xs font-medium mt-1", cls)}>
        {arrow} {formatBRL(Math.abs(diff))} ({pct >= 0 ? "+" : ""}{pct.toFixed(0)}%)
      </div>
    </div>
  );
}
