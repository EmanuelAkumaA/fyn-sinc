import { formatBRL } from "@/lib/fynsinc";

type Props = {
  kuma: number;
  cliente: number;
  cashback: number;
  taxas: number;
  /** Se true, esconde chips com valor zero (para o Dashboard). */
  hideZero?: boolean;
};

const chip =
  "inline-flex items-center justify-between gap-1 rounded-md border px-2 py-1 text-[11px] sm:text-xs font-medium leading-tight min-w-0";

export function BankBreakdownChips({ kuma, cliente, cashback, taxas, hideZero }: Props) {
  const items = [
    { label: "Kuma", value: kuma, cls: kuma >= 0 ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20" },
    { label: "Aportes", value: cliente, cls: "bg-primary/10 text-primary border-primary/20" },
    { label: "Cashback", value: cashback, cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    { label: "Taxas", value: -Math.abs(taxas), cls: "bg-destructive/10 text-destructive border-destructive/20" },
  ];
  const visible = hideZero ? items.filter((i) => Math.abs(i.value) > 0.005) : items;
  if (visible.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-1.5 mt-2 sm:flex sm:flex-wrap">
      {visible.map((i) => (
        <span key={i.label} className={`${chip} ${i.cls}`}>
          <span className="truncate">{i.label}</span>
          <span className="tabular-nums shrink-0">{formatBRL(i.value)}</span>
        </span>
      ))}
    </div>
  );
}
