import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, ExternalLink, User,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL, formatDate } from "@/lib/fynsinc";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { PayTransactionDialog, type PayTx } from "@/components/pay-transaction-dialog";

type Tx = {
  id: string;
  type: string;
  status: string;
  amount_gross: number | string;
  description: string;
  due_date: string | null;
  paid_at: string | null;
  client_id: string | null;
  bank_id: string | null;
  recurring_contract_id: string | null;
};

type FilterKey = "todos" | "a_receber" | "recebidos" | "atrasados" | "receita" | "repasses" | "mensalidades" | "avulsos";

const FILTERS: { k: FilterKey; label: string }[] = [
  { k: "todos", label: "Todos" },
  { k: "a_receber", label: "A receber" },
  { k: "recebidos", label: "Recebidos" },
  { k: "atrasados", label: "Atrasados" },
  { k: "receita", label: "Receita própria" },
  { k: "repasses", label: "Repasses" },
  { k: "mensalidades", label: "Mensalidades" },
  { k: "avulsos", label: "Avulsos" },
];

const RECEITA_TYPES = ["receita_propria", "comissao", "cashback"];
const REPASSE_TYPES = ["repasse_recebido", "uso_repasse"];

const todayStr = () => new Date().toISOString().slice(0, 10);

function monthRange(d: Date) {
  const y = d.getFullYear(), m = d.getMonth();
  const first = new Date(y, m, 1).toISOString().slice(0, 10);
  const last = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { first, last, ym: `${y}-${String(m + 1).padStart(2, "0")}` };
}

type Bucket = "a_receber" | "recebido" | "atrasado" | "repasse" | "despesa" | "outro";

function bucketOf(t: Tx): Bucket {
  const today = todayStr();
  if (REPASSE_TYPES.includes(t.type)) return "repasse";
  if (t.type === "taxa" || t.type === "despesa_propria") return "despesa";
  if (RECEITA_TYPES.includes(t.type)) {
    if (t.status === "pago") return "recebido";
    if (t.status === "pendente") {
      if (t.due_date && t.due_date < today) return "atrasado";
      return "a_receber";
    }
  }
  return "outro";
}

function dayKey(t: Tx): string | null {
  if (t.status === "pago") return t.paid_at;
  return t.due_date;
}

const BUCKET_LABEL: Record<Bucket, string> = {
  a_receber: "A receber",
  recebido: "Recebido",
  atrasado: "Atrasado",
  repasse: "Repasse",
  despesa: "Despesa",
  outro: "—",
};

const BUCKET_CLASS: Record<Bucket, string> = {
  a_receber: "bg-primary/15 text-primary border-primary/30",
  recebido: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  atrasado: "bg-[color:var(--destructive)]/15 text-[color:var(--destructive)] border-[color:var(--destructive)]/30",
  repasse: "bg-muted text-muted-foreground border-border",
  despesa: "bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]/90 border-[color:var(--destructive)]/20",
  outro: "bg-muted text-muted-foreground border-border",
};

const MONTH_LABEL = (d: Date) =>
  d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());

export function FinancialCalendar() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(true);
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [payTx, setPayTx] = useState<PayTx | null>(null);

  const { first, last, ym } = useMemo(() => monthRange(cursor), [cursor]);

  const { data: txs = [] } = useQuery({
    queryKey: ["calendar", ym],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("id, type, status, amount_gross, description, due_date, paid_at, client_id, bank_id, recurring_contract_id")
        .or(`and(due_date.gte.${first},due_date.lte.${last}),and(paid_at.gte.${first},paid_at.lte.${last})`)
        .limit(2000);
      if (error) throw error;
      return data as Tx[];
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
  const clientName = (id: string | null) => clients.find((c: any) => c.id === id)?.name ?? "—";
  const bankName = (id: string | null) => banks.find((b: any) => b.id === id)?.name ?? "—";

  // Filter transactions for current view
  const visible = useMemo(() => {
    return txs.filter((t) => {
      // transferencias never in calendar
      if (t.type === "transferencia") return false;
      const b = bucketOf(t);
      if (b === "outro") return false;
      switch (filter) {
        case "todos": return true;
        case "a_receber": return b === "a_receber";
        case "recebidos": return b === "recebido";
        case "atrasados": return b === "atrasado";
        case "receita": return RECEITA_TYPES.includes(t.type);
        case "repasses": return REPASSE_TYPES.includes(t.type);
        case "mensalidades": return !!t.recurring_contract_id;
        case "avulsos": return !t.recurring_contract_id && RECEITA_TYPES.includes(t.type);
      }
    });
  }, [txs, filter]);

  // Summary cards (always based on receita própria, ignoring filter chips)
  const summary = useMemo(() => {
    const today = todayStr();
    let previsto = 0, recebido = 0, atraso = 0, areceber = 0;
    for (const t of txs) {
      if (!RECEITA_TYPES.includes(t.type)) continue;
      const amt = Number(t.amount_gross || 0);
      if (t.status === "pendente" && t.due_date && t.due_date >= first && t.due_date <= last) {
        previsto += amt;
        if (t.due_date < today) atraso += amt; else areceber += amt;
      }
      if (t.status === "pago" && t.paid_at && t.paid_at >= first && t.paid_at <= last) {
        recebido += amt;
      }
    }
    return { previsto, recebido, atraso, areceber };
  }, [txs, first, last]);

  // Group by day
  const byDay = useMemo(() => {
    const m = new Map<string, Tx[]>();
    for (const t of visible) {
      const k = dayKey(t);
      if (!k) continue;
      if (k < first || k > last) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return m;
  }, [visible, first, last]);

  // Build days grid (Mon=0 ... Sun=6)
  const daysGrid = useMemo(() => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const firstD = new Date(y, m, 1);
    // shift so Monday=0
    const start = (firstD.getDay() + 6) % 7;
    const totalDays = new Date(y, m + 1, 0).getDate();
    const cells: { date: string; inMonth: boolean; day: number }[] = [];
    for (let i = 0; i < start; i++) {
      const d = new Date(y, m, -start + i + 1);
      cells.push({ date: d.toISOString().slice(0, 10), inMonth: false, day: d.getDate() });
    }
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(y, m, i);
      cells.push({ date: d.toISOString().slice(0, 10), inMonth: true, day: i });
    }
    while (cells.length % 7 !== 0) {
      const last = new Date(cells[cells.length - 1].date);
      last.setDate(last.getDate() + 1);
      cells.push({ date: last.toISOString().slice(0, 10), inMonth: false, day: last.getDate() });
    }
    return cells;
  }, [cursor]);

  const today = todayStr();
  const selectedItems = selectedDay ? byDay.get(selectedDay) ?? [] : [];

  const goPrev = () => { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d); };
  const goNext = () => { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d); };
  const goToday = () => { const d = new Date(); d.setDate(1); setCursor(d); };

  return (
    <section className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          <CalendarDays className="w-4 h-4" />
          Calendário financeiro
          <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="flex items-center gap-1 justify-between sm:justify-end">
            <Button size="sm" variant="ghost" onClick={goToday}>Hoje</Button>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={goPrev} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="font-display font-medium text-xs sm:text-sm min-w-[110px] sm:min-w-[120px] text-center capitalize">{MONTH_LABEL(cursor)}</span>
              <Button size="icon" variant="ghost" onClick={goNext} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {open && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-xs text-muted-foreground -mt-2">Previsão e recebimentos do mês</p>

          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <SummaryCard label="Previsto no mês" value={summary.previsto} tone="primary" />
            <SummaryCard label="Recebido no mês" value={summary.recebido} tone="success" />
            <SummaryCard label="Em atraso" value={summary.atraso} tone="destructive" />
            <SummaryCard label="A receber" value={summary.areceber} tone="muted" />
          </div>

          {/* Filtro */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">Filtrar lançamentos</span>
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
              <SelectTrigger className="h-9 w-[180px] sm:w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FILTERS.map((f) => (
                  <SelectItem key={f.k} value={f.k}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          {visible.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="font-display font-medium">Nenhum lançamento financeiro neste mês.</p>
              <p className="text-sm text-muted-foreground mt-1">Quando você criar receitas, recorrências ou marcar pagamentos, eles aparecerão aqui.</p>
            </div>
          ) : isMobile ? (
            <AgendaView byDay={byDay} clientName={clientName} onPick={setSelectedDay} />
          ) : (
            <GridView
              cells={daysGrid}
              byDay={byDay}
              today={today}
              onPick={setSelectedDay}
            />
          )}
        </div>
      )}

      {/* Drawer dia */}
      <Sheet open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <SheetContent side={isMobile ? "bottom" : "right"} className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedDay && new Date(selectedDay + "T00:00:00").toLocaleDateString("pt-BR", {
                weekday: "long", day: "2-digit", month: "long",
              })}
            </SheetTitle>
          </SheetHeader>
          {selectedDay && <DayDetails
            items={selectedItems}
            clientName={clientName}
            bankName={bankName}
            onPay={(t) => setPayTx(t)}
            onOpenClient={(id) => { setSelectedDay(null); navigate({ to: "/clientes/$id", params: { id } }); }}
            onOpenFinanceiro={() => { setSelectedDay(null); navigate({ to: "/financeiro" }); }}
          />}
        </SheetContent>
      </Sheet>

      <PayTransactionDialog tx={payTx} onOpenChange={(o) => !o && setPayTx(null)} />
    </section>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "primary" | "success" | "destructive" | "muted" }) {
  const toneClass: Record<string, string> = {
    primary: "text-primary",
    success: "text-[color:var(--success)]",
    destructive: "text-[color:var(--destructive)]",
    muted: "text-foreground",
  };
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className={cn("font-display font-semibold text-base md:text-lg mt-0.5", toneClass[tone])}>{formatBRL(value)}</div>
    </div>
  );
}

const WEEK_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function GridView({
  cells, byDay, today, onPick,
}: {
  cells: { date: string; inMonth: boolean; day: number }[];
  byDay: Map<string, Tx[]>;
  today: string;
  onPick: (date: string) => void;
}) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEK_LABELS.map((w) => (
          <div key={w} className="text-[10px] uppercase tracking-wider text-muted-foreground text-center py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const items = byDay.get(c.date) ?? [];
          const isToday = c.date === today;
          const shown = items.slice(0, 2);
          const more = items.length - shown.length;
          return (
            <button
              type="button"
              key={c.date}
              onClick={() => items.length > 0 && onPick(c.date)}
              className={cn(
                "min-h-[88px] rounded-lg p-1.5 text-left flex flex-col gap-1 border transition-colors",
                c.inMonth ? "bg-secondary/20 border-border" : "bg-transparent border-transparent opacity-40",
                isToday && "border-primary/60 ring-1 ring-primary/30",
                items.length > 0 && "hover:bg-secondary/40 cursor-pointer"
              )}
            >
              <span className={cn(
                "text-[11px] font-medium",
                isToday ? "text-primary" : "text-muted-foreground"
              )}>{c.day}</span>
              <div className="flex flex-col gap-0.5">
                {shown.map((t) => {
                  const b = bucketOf(t);
                  return (
                    <span
                      key={t.id}
                      className={cn("truncate text-[10px] px-1.5 py-0.5 rounded border", BUCKET_CLASS[b])}
                      title={`${BUCKET_LABEL[b]} · ${formatBRL(Number(t.amount_gross))}`}
                    >
                      {formatBRL(Number(t.amount_gross))}
                    </span>
                  );
                })}
                {more > 0 && (
                  <span className="text-[10px] text-muted-foreground px-1.5">+{more}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({
  byDay, clientName, onPick,
}: {
  byDay: Map<string, Tx[]>;
  clientName: (id: string | null) => string;
  onPick: (d: string) => void;
}) {
  const days = [...byDay.keys()].sort();
  return (
    <div className="space-y-2">
      {days.map((d) => {
        const items = byDay.get(d) ?? [];
        return (
          <button
            key={d}
            onClick={() => onPick(d)}
            className="w-full text-left glass rounded-xl p-3 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-semibold text-sm">
                {new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", weekday: "short" })}
              </span>
              <span className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? "lançamento" : "lançamentos"}</span>
            </div>
            <div className="space-y-1">
              {items.slice(0, 3).map((t) => {
                const b = bucketOf(t);
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate flex-1">{clientName(t.client_id)} — {t.description}</span>
                    <span className={cn("shrink-0 px-1.5 py-0.5 rounded border text-[10px]", BUCKET_CLASS[b])}>
                      {formatBRL(Number(t.amount_gross))}
                    </span>
                  </div>
                );
              })}
              {items.length > 3 && (
                <p className="text-[11px] text-muted-foreground">+{items.length - 3} mais</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DayDetails({
  items, clientName, bankName, onPay, onOpenClient, onOpenFinanceiro,
}: {
  items: Tx[];
  clientName: (id: string | null) => string;
  bankName: (id: string | null) => string;
  onPay: (t: PayTx) => void;
  onOpenClient: (id: string) => void;
  onOpenFinanceiro: () => void;
}) {
  const totals = useMemo(() => {
    let areceber = 0, recebido = 0, atrasado = 0, repasses = 0;
    for (const t of items) {
      const b = bucketOf(t);
      const amt = Number(t.amount_gross || 0);
      if (b === "a_receber") areceber += amt;
      else if (b === "recebido") recebido += amt;
      else if (b === "atrasado") atrasado += amt;
      else if (b === "repasse") repasses += amt;
    }
    return { areceber, recebido, atrasado, repasses };
  }, [items]);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground mt-6">Sem lançamentos neste dia.</p>;
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="A receber" value={totals.areceber} tone="primary" />
        <MiniStat label="Recebido" value={totals.recebido} tone="success" />
        <MiniStat label="Atrasado" value={totals.atrasado} tone="destructive" />
        <MiniStat label="Repasses" value={totals.repasses} tone="muted" />
      </div>

      <div className="space-y-2">
        {items.map((t) => {
          const b = bucketOf(t);
          return (
            <div key={t.id} className="glass rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{t.description}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    <span>{clientName(t.client_id)}</span>
                    <span className="capitalize">· {t.type.replace(/_/g, " ")}</span>
                    {t.bank_id && <span>· {bankName(t.bank_id)}</span>}
                    <span>· {t.status === "pago" ? `Pago em ${formatDate(t.paid_at)}` : `Vence ${formatDate(t.due_date)}`}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display font-semibold text-sm">{formatBRL(Number(t.amount_gross))}</div>
                  <span className={cn("inline-block mt-1 px-1.5 py-0.5 rounded border text-[10px]", BUCKET_CLASS[b])}>{BUCKET_LABEL[b]}</span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-1">
                {t.status !== "pago" && RECEITA_TYPES.includes(t.type) && (
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onPay(t)}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Marcar pago
                  </Button>
                )}
                {t.client_id && (
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onOpenClient(t.client_id!)}>
                    <User className="h-3.5 w-3.5" /> Cliente
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={onOpenFinanceiro}>
                  <ExternalLink className="h-3.5 w-3.5" /> Financeiro
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "primary" | "success" | "destructive" | "muted" }) {
  const cls: Record<string, string> = {
    primary: "text-primary",
    success: "text-[color:var(--success)]",
    destructive: "text-[color:var(--destructive)]",
    muted: "text-foreground",
  };
  return (
    <div className="rounded-lg bg-secondary/30 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("font-display font-semibold text-sm mt-0.5", cls[tone])}>{formatBRL(value)}</div>
    </div>
  );
}
