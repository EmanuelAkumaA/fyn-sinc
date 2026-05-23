import { cn } from "@/lib/utils";
import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  trend?: number;
  icon?: LucideIcon;
  tone?: "default" | "success" | "destructive" | "primary";
  className?: string;
}

const toneClass: Record<string, string> = {
  default: "text-foreground",
  success: "text-[color:var(--success)]",
  destructive: "text-[color:var(--destructive)]",
  primary: "text-primary",
};

export function MetricCard({ label, value, hint, trend, icon: Icon, tone = "default", className }: MetricCardProps) {
  return (
    <div className={cn("glass rounded-2xl p-3 sm:p-5 flex flex-col gap-1.5 sm:gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium leading-tight">{label}</span>
        {Icon && (
          <div className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        )}
      </div>
      <div className={cn("font-display text-lg sm:text-2xl md:text-3xl font-bold tracking-tight break-words", toneClass[tone])}>
        {value}
      </div>
      {(hint || typeof trend === "number") && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {typeof trend === "number" && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", trend >= 0 ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]")}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend).toFixed(0)}%
            </span>
          )}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </div>
  );
}
