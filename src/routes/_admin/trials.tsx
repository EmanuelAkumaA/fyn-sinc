import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTrials } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/fynsinc";
import { useState } from "react";

const FILTERS = [
  { v: "all", label: "Todos" },
  { v: "active", label: "Ativos" },
  { v: "expiring", label: "Expirando ≤ 3d" },
  { v: "expired", label: "Expirados" },
  { v: "converted", label: "Convertidos" },
] as const;

export const Route = createFileRoute("/_admin/trials")({
  component: TrialsPage,
  head: () => ({ meta: [{ title: "Trials — Fyn Sinc Admin" }] }),
});

function TrialsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["v"]>("all");
  const fn = useServerFn(listTrials);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-trials", filter],
    queryFn: () => fn({ data: { filter } }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Trials</h1>
        <p className="text-muted-foreground text-sm">Acompanhe testes ativos, expirando e convertidos</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={"px-3 py-1.5 rounded-lg text-sm font-medium transition " + (filter === f.v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plano</th><th className="px-4 py-3">Trial fim</th>
              <th className="px-4 py-3">Criada</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
            {(data ?? []).map((o) => (
              <tr key={o.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <Link to="/admin/organizations/$id" params={{ id: o.id }} className="font-medium hover:text-primary">{o.name}</Link>
                </td>
                <td className="px-4 py-3"><Badge>{o.status}</Badge></td>
                <td className="px-4 py-3 capitalize">{o.plan}</td>
                <td className="px-4 py-3">{o.trial_ends_at ? formatDate(o.trial_ends_at) : "—"}</td>
                <td className="px-4 py-3">{formatDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
