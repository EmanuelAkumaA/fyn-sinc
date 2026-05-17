import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllUsers } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/fynsinc";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Usuários — Fyn Sinc Admin" }] }),
});

function UsersPage() {
  const fn = useServerFn(listAllUsers);
  const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => fn() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Usuários</h1>
        <p className="text-muted-foreground text-sm">Todos os usuários do Fyn Sinc</p>
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3">Nome</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Global</th>
              <th className="px-4 py-3">Organizações</th><th className="px-4 py-3">Criado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
            {(data ?? []).map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                <td className="px-4 py-3">{u.name ?? "—"}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.global_role ? <Badge>{u.global_role}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.orgs.map((o) => (
                      <Badge key={o.id} variant="outline">{o.name} · {o.role}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">{formatDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
