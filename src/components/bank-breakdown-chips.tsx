import { formatBRL } from "@/lib/fynsinc";

type Props = {
  kuma: number;
  cliente: number;
  cashback: number;
  taxas: number;
  /** Se true, esconde chips com valor zero (para o Dashboard). */
  hideZero?: boolean;
};

export function BankBreakdownChips({ kuma, cliente, cashback, taxas, hideZero }: Props) {
  const items = [
    {
      label: "Kuma",
      value: kuma,
      cls:
        kuma >= 0
          ? "bg-success/10 text-success border-success/20"
          : "bg-destructive/10 text-destructive border-destructive/20",
    },
    {
      label: "Aportes",
      value: cliente,
      cls: "bg-primary/10 text-primary border-primary/20",
    },
    {
      label: "Cashback",
      value: cashback,
      cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      label: "Taxas",
      value: -Math.abs(taxas),
      cls: "bg-destructive/10 text-destructive border-destructive/20",
    },
  ];
  const visible = hideZero ? items.filter((i) => Math.abs(i.value) > 0.005) : items;
  if (visible.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-1.5 mt-3 sm:flex sm:flex-wrap">
      {visible.map((i) => (
        <div
          key={i.label}
          className={`flex flex-col items-start gap-0 rounded-lg border px-2.5 py-1.5 leading-tight sm:flex-row sm:items-center sm:gap-1.5 ${i.cls}`}
        >
          <span className="text-[10px] font-medium uppercase tracking-wide opacity-80 sm:text-[11px] sm:normal-case sm:tracking-normal sm:opacity-100">
            {i.label}
          </span>
          <span className="text-xs font-semibold tabular-nums sm:text-xs">
            {formatBRL(i.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
