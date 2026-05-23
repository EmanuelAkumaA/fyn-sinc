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
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium border whitespace-nowrap";

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
    <div className="flex flex-wrap gap-1.5 mt-2">
      {visible.map((i) => (
        <span key={i.label} className={`${chip} ${i.cls}`}>
          {i.label} · {formatBRL(i.value)}
        </span>
      ))}
    </div>
  );
}
