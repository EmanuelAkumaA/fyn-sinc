import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function EmptyState({ icon, title, description, action, className }: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass rounded-2xl p-10 text-center flex flex-col items-center gap-3", className)}>
      {icon && <div className="h-12 w-12 rounded-2xl bg-secondary/50 flex items-center justify-center text-muted-foreground">{icon}</div>}
      <h3 className="font-display font-semibold text-lg">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ativo: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
    pago: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
    recebido: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
    concluido: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
    pendente: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
    pausado: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
    atrasado: "bg-[color:var(--destructive)]/15 text-[color:var(--destructive)]",
    inadimplente: "bg-[color:var(--destructive)]/15 text-[color:var(--destructive)]",
    cancelado: "bg-muted text-muted-foreground",
    inativo: "bg-muted text-muted-foreground",
    pago_fornecedor: "bg-primary/15 text-primary",
  };
  const cls = map[status] ?? "bg-muted text-muted-foreground";
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize", cls)}>{status.replace("_", " ")}</span>;
}

const BADGE_BASE = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium";

export function ClientStatusBadge({ value }: { value: string | null | undefined }) {
  const v = value === "inativo" ? "inativo" : "ativo";
  const cls = v === "ativo"
    ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
    : "bg-muted text-muted-foreground";
  return <span className={cn(BADGE_BASE, cls)}>{v === "ativo" ? "Ativo" : "Inativo"}</span>;
}

export function FinancialStatusBadge({ value }: { value: string | null | undefined }) {
  const v = value === "inadimplente" ? "inadimplente" : "em_dia";
  const cls = v === "em_dia"
    ? "bg-primary/15 text-primary"
    : "bg-[color:var(--destructive)]/15 text-[color:var(--destructive)]";
  return <span className={cn(BADGE_BASE, cls)}>{v === "em_dia" ? "Em dia" : "Inadimplente"}</span>;
}
