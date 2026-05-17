import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getOrganization,
  activateOrg,
  suspendOrg,
  cancelOrg,
  extendTrial,
  changePlan,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/fynsinc";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/organizations/$id")({
  component: OrgDetail,
});

type Plan = "trial" | "starter" | "professional" | "enterprise";

function OrgDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchOrg = useServerFn(getOrganization);
  const fnActivate = useServerFn(activateOrg);
  const fnSuspend = useServerFn(suspendOrg);
  const fnCancel = useServerFn(cancelOrg);
  const fnExtend = useServerFn(extendTrial);
  const fnPlan = useServerFn(changePlan);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-org", id],
    queryFn: () => fetchOrg({ data: { id } }),
  });

  const [plan, setPlan] = useState<Plan>("starter");
  const [extDays, setExtDays] = useState(15);

  if (isLoading || !data) return <div className="text-muted-foreground">Carregando…</div>;
  const { org, users } = data;

  async function run(action: () => Promise<unknown>, ok: string) {
    try { await action(); toast.success(ok); qc.invalidateQueries({ queryKey: ["admin-org", id] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha"); }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin/organizations" })}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">{org.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge>{org.status}</Badge>
            <Badge variant="outline">Plano: {org.plan}</Badge>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5 space-y-2">
          <h2 className="font-display font-semibold mb-2">Dados</h2>
          <div className="text-sm"><span className="text-muted-foreground">Criada:</span> {formatDate(org.created_at)}</div>
          <div className="text-sm"><span className="text-muted-foreground">Trial início:</span> {org.trial_start_at ? formatDate(org.trial_start_at) : "—"}</div>
          <div className="text-sm"><span className="text-muted-foreground">Trial fim:</span> {org.trial_ends_at ? formatDate(org.trial_ends_at) : "—"}</div>
          <div className="text-sm"><span className="text-muted-foreground">Assinatura início:</span> {org.subscription_start_at ? formatDate(org.subscription_start_at) : "—"}</div>
        </div>

        <div className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-display font-semibold mb-2">Ações</h2>
          <div className="flex items-center gap-2">
            <Select value={plan} onValueChange={(v) => setPlan(v as Plan)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["trial","starter","professional","enterprise"].map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => run(() => fnActivate({ data: { id, plan } }), "Organização ativada")}>Ativar</Button>
            <Button variant="outline" onClick={() => run(() => fnPlan({ data: { id, plan } }), "Plano atualizado")}>Trocar plano</Button>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={365} value={extDays} onChange={(e) => setExtDays(Number(e.target.value))} className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm" />
            <Button variant="outline" onClick={() => run(() => fnExtend({ data: { id, days: extDays } }), "Trial estendido")}>Estender trial (dias)</Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => run(() => fnSuspend({ data: { id } }), "Organização suspensa")}>Suspender</Button>
            <Button variant="destructive" onClick={() => run(() => fnCancel({ data: { id } }), "Organização cancelada")}>Cancelar</Button>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-display font-semibold mb-3">Usuários ({users.length})</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2">Nome</th><th className="py-2">E-mail</th><th className="py-2">Papel</th><th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} className="border-t border-border">
                <td className="py-2">{u.name ?? "—"}</td>
                <td className="py-2">{u.email ?? "—"}</td>
                <td className="py-2">{u.member_role}</td>
                <td className="py-2">{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
