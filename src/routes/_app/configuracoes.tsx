import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Settings, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui-helpers";
import { getCurrentOrgId } from "@/lib/fynsinc";

export const Route = createFileRoute("/_app/configuracoes")({
  component: ConfiguracoesPage,
  head: () => ({ meta: [{ title: "Configurações — Fyn Sinc" }] }),
});

function ConfiguracoesPage() {
  const qc = useQueryClient();
  const [orgName, setOrgName] = useState("");

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
  });

  const { data: org } = useQuery({
    queryKey: ["current-org"],
    queryFn: async () => {
      const orgId = await getCurrentOrgId();
      if (!orgId) return null;
      const { data, error } = await supabase.from("organizations").select("*").eq("id", orgId).maybeSingle();
      if (error) throw error;
      setOrgName(data?.name ?? "");
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["org-members", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("organization_users").select("*").eq("organization_id", org!.id).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const updateOrg = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error("Organização não encontrada");
      const { error } = await supabase.from("organizations").update({ name: orgName }).eq("id", org.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Organização atualizada");
      qc.invalidateQueries({ queryKey: ["current-org"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Configurações" subtitle="Dados da organização e acesso" />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-secondary/60 flex items-center justify-center text-muted-foreground"><Building2 className="h-5 w-5" /></div>
            <div>
              <h2 className="font-display font-semibold">Organização</h2>
              <p className="text-xs text-muted-foreground">Identificação usada nos registros financeiros.</p>
            </div>
          </div>
          {org ? (
            <form onSubmit={(e) => { e.preventDefault(); updateOrg.mutate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={orgName} onChange={(e) => setOrgName(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Slug</Label><Input value={org.slug ?? ""} disabled /></div>
              <Button type="submit" disabled={updateOrg.isPending} style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
                {updateOrg.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </form>
          ) : (
            <EmptyState icon={<Settings className="h-6 w-6" />} title="Organização não encontrada" description="Entre novamente para carregar os dados da organização." className="p-6" />
          )}
        </section>

        <section className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-secondary/60 flex items-center justify-center text-muted-foreground"><UserRound className="h-5 w-5" /></div>
            <div>
              <h2 className="font-display font-semibold">Usuário e permissões</h2>
              <p className="text-xs text-muted-foreground">Sessão atual e membros vinculados.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl bg-secondary/30 p-3">
              <div className="text-xs text-muted-foreground">Usuário atual</div>
              <div className="text-sm font-medium truncate">{user?.email ?? "—"}</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Membros</div>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum membro listado.</p>
              ) : (
                members.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3 min-w-0">
                    <span className="text-sm truncate min-w-0 flex-1">{m.user_id}</span>
                    <StatusBadge status={m.role} />
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
