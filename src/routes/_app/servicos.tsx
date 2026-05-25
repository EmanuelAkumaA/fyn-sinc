import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Briefcase, Pencil, Plus, Search, Users, Wallet, Repeat, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui-helpers";
import { MetricCard } from "@/components/metric-card";
import { ServiceDossier } from "@/components/service-dossier";
import { formatBRL, getCurrentOrgId } from "@/lib/fynsinc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/servicos")({
  component: ServicosPage,
  head: () => ({ meta: [{ title: "Serviços — Fyn Sinc" }] }),
});

type ServiceSummary = {
  service_id: string;
  organization_id: string;
  service_name: string;
  service_type: string;
  category: string | null;
  status: string;
  default_value: number | null;
  description: string | null;
  active_clients_count: number;
  total_clients_count: number;
  inactive_clients_count: number;
  total_revenue: number;
  average_ticket: number | null;
  overdue_amount: number;
  pending_amount: number;
  active_recurring_count: number;
  active_mrr: number;
  paid_transactions_count: number;
};

function ServicosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [dossierId, setDossierId] = useState<string | null>(null);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["service-summary"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_service_summary")
        .select("*")
        .order("service_name");
      if (error) throw error;
      return (data ?? []) as ServiceSummary[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: any) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Organização não encontrada");
      const data = {
        name: payload.name,
        type: payload.type,
        category: payload.category || null,
        default_value: payload.default_value ? Number(payload.default_value) : null,
        description: payload.description || null,
        status: payload.status,
      };
      const result = editing?.id
        ? await supabase.from("services").update(data).eq("id", editing.id)
        : await supabase.from("services").insert({ ...data, organization_id: org });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success(editing ? "Serviço atualizado" : "Serviço criado");
      qc.invalidateQueries({ queryKey: ["service-summary"] });
      qc.invalidateQueries({ queryKey: ["services-min"] });
      qc.invalidateQueries({ queryKey: ["service"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = services.filter((s) => {
    const term = search.toLowerCase();
    return s.service_name.toLowerCase().includes(term) || (s.category ?? "").toLowerCase().includes(term);
  });
  const active = services.filter((s) => s.status === "ativo").length;
  const recurring = services.filter((s) => s.service_type === "recorrente").length;
  const totalRevenue = services.reduce((sum, s) => sum + Number(s.total_revenue ?? 0), 0);
  const totalMrr = services.reduce((sum, s) => sum + Number(s.active_mrr ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Serviços"
        subtitle="Catálogo estratégico — clique em um serviço para ver o dossiê completo"
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
            <Plus className="h-4 w-4" /> Novo serviço
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Serviços ativos" value={String(active)} hint={`${services.length} no total`} icon={Briefcase} />
        <MetricCard label="Recorrentes" value={String(recurring)} hint="No catálogo" icon={Repeat} />
        <MetricCard label="Receita total" value={formatBRL(totalRevenue)} hint="Todos os serviços" tone="success" icon={Wallet} />
        <MetricCard label="MRR ativo total" value={formatBRL(totalMrr)} hint="Equivalente mensal" tone="primary" icon={Repeat} />
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar serviço..." className="pl-9" />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Briefcase className="h-6 w-6" />} title="Nenhum serviço" description="Cadastre serviços para vincular receitas, planos e contratos recorrentes." />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const isRec = s.service_type === "recorrente";
            const hasData =
              s.total_clients_count > 0 || s.total_revenue > 0 || s.active_recurring_count > 0;
            return (
              <button
                key={s.service_id}
                type="button"
                onClick={() => setDossierId(s.service_id)}
                className="glass rounded-2xl p-4 flex flex-col gap-2 w-full text-left hover:bg-card/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{s.service_name}</span>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                      <span className="capitalize">{s.service_type}</span>
                      {s.category && <><span>·</span><span>{s.category}</span></>}
                      {s.default_value != null && <><span>·</span><span>{formatBRL(s.default_value)}</span></>}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); setEditing({
                      id: s.service_id, name: s.service_name, type: s.service_type,
                      category: s.category, default_value: s.default_value,
                      description: s.description, status: s.status,
                    }); setOpen(true); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>

                {hasData ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Chip icon={<Users className="h-3 w-3" />} label="Ativos" value={String(s.active_clients_count)} />
                    <Chip icon={<Users className="h-3 w-3" />} label="Já compraram" value={String(s.total_clients_count)} />
                    {s.total_revenue > 0 && (
                      <Chip icon={<Wallet className="h-3 w-3" />} label="Receita" value={formatBRL(s.total_revenue)} tone="success" />
                    )}
                    {isRec && s.active_mrr > 0 && (
                      <Chip icon={<Repeat className="h-3 w-3" />} label="MRR" value={formatBRL(s.active_mrr)} tone="primary" />
                    )}
                    {!isRec && s.pending_amount > 0 && (
                      <Chip label="Avulsos pend." value={formatBRL(s.pending_amount)} />
                    )}
                    {s.average_ticket != null && s.average_ticket > 0 && (
                      <Chip label="Ticket médio" value={formatBRL(s.average_ticket)} />
                    )}
                    {s.overdue_amount > 0 && (
                      <Chip icon={<AlertTriangle className="h-3 w-3" />} label="Em atraso" value={formatBRL(s.overdue_amount)} tone="destructive" />
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem vendas vinculadas ainda.</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? "Editar serviço" : "Novo serviço"}</SheetTitle></SheetHeader>
          <ServiceForm initial={editing} loading={save.isPending} onSubmit={(data) => save.mutate(data)} />
        </SheetContent>
      </Sheet>

      <ServiceDossier
        serviceId={dossierId}
        open={!!dossierId}
        onOpenChange={(o) => !o && setDossierId(null)}
        onEdit={(svc) => { setEditing(svc); setOpen(true); setDossierId(null); }}
      />
    </>
  );
}

function Chip({ icon, label, value, tone }: { icon?: React.ReactNode; label: string; value: string; tone?: "success" | "destructive" | "primary" }) {
  const toneCls = tone === "success" ? "bg-[color:var(--success)]/10 text-[color:var(--success)]"
    : tone === "destructive" ? "bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]"
    : tone === "primary" ? "bg-primary/10 text-primary"
    : "bg-secondary/50 text-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium", toneCls)}>
      {icon}
      <span className="text-muted-foreground">{label}:</span>
      <span>{value}</span>
    </span>
  );
}

function ServiceForm({ initial, loading, onSubmit }: { initial: any | null; loading: boolean; onSubmit: (data: any) => void }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    type: initial?.type ?? "avulso",
    category: initial?.category ?? "",
    default_value: initial?.default_value?.toString() ?? "",
    description: initial?.description ?? "",
    status: initial?.status ?? "ativo",
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4 mt-6">
      <div className="space-y-2"><Label>Nome *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="avulso">Avulso</SelectItem>
              <SelectItem value="recorrente">Recorrente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2"><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
      <div className="space-y-2"><Label>Valor padrão</Label><Input type="number" step="0.01" value={form.default_value} onChange={(e) => setForm({ ...form, default_value: e.target.value })} /></div>
      <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <Button type="submit" disabled={loading} className="w-full" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
        {loading ? "Salvando..." : "Salvar serviço"}
      </Button>
    </form>
  );
}
