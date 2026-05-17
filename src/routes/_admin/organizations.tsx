import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listOrganizations } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/fynsinc";

export const Route = createFileRoute("/_admin/organizations")({
  component: OrgsList,
  head: () => ({ meta: [{ title: "Organizações — Fyn Sinc Admin" }] }),
});

const STATUS_TONE: Record<string, string> = {
  trial: "bg-primary/15 text-primary",
  active: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  suspended: "bg-yellow-500/15 text-yellow-500",
  expired: "bg-[color:var(--destructive)]/15 text-[color:var(--destructive)]",
  canceled: "bg-muted text-muted-foreground",
};

function OrgsList() {
  const fn = useServerFn(listOrganizations);
  const { data, isLoading } = useQuery({ queryKey: ["admin-orgs"], queryFn: () => fn() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Organizações</h1>
        <p className="text-muted-foreground text-sm">Todas as empresas cadastradas no Fyn Sinc</p>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Trial fim</th>
              <th className="px-4 py-3">Criada</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {(data ?? []).map((o) => (
              <tr key={o.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <Link to="/admin/organizations/$id" params={{ id: o.id }} className="font-medium hover:text-primary">
                    {o.name}
                  </Link>
                </td>
                <td className="px-4 py-3"><Badge className={STATUS_TONE[o.status] ?? ""}>{o.status}</Badge></td>
                <td className="px-4 py-3 capitalize">{o.plan}</td>
                <td className="px-4 py-3">
                  <div>{o.owner_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{o.owner_email ?? "—"}</div>
                </td>
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
