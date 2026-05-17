import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PageHeader, EmptyState } from "@/components/ui-helpers";
import { getCurrentOrgId } from "@/lib/fynsinc";
import { ClientCard } from "@/components/client-card";
import { ClientForm, type ClientRow, type ClientFormState } from "@/components/client-form";
import { ClientDossier } from "@/components/client-dossier";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientesPage,
  head: () => ({ meta: [{ title: "Clientes — Fyn Sinc" }] }),
});


function ClientesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientStatusFilter, setClientStatusFilter] = useState<string>("todos");
  const [financialStatusFilter, setFinancialStatusFilter] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as unknown as ClientRow[];
    },
  });

  const closeSheet = () => {
    setOpen(false);
    setEditing(null);
  };

  const create = useMutation({
    mutationFn: async (payload: Partial<ClientRow>) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Organização não encontrada");
      const { error } = await supabase
        .from("clients")
        .insert({ ...payload, organization_id: org } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente criado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      closeSheet();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ClientRow> }) => {
      const { error } = await supabase.from("clients").update(payload as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente atualizado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      closeSheet();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onlyDigits = (s: string) => s.replace(/\D/g, "");
  const q = search.trim().toLowerCase();
  const qDigits = onlyDigits(q);
  const filtered = clients.filter((c) => {
    const cStatus = c.client_status ?? (c.status === "inativo" ? "inativo" : "ativo");
    const fStatus = c.financial_status ?? (c.status === "inadimplente" ? "inadimplente" : "em_dia");
    if (clientStatusFilter !== "todos" && cStatus !== clientStatusFilter) return false;
    if (financialStatusFilter !== "todos" && fStatus !== financialStatusFilter) return false;
    if (!q) return true;
    const haystack = [c.name, c.company, c.email, c.phone, c.document]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase())
      .join(" ");
    if (haystack.includes(q)) return true;
    if (qDigits && [c.phone, c.document].some((v) => v && onlyDigits(v).includes(qDigits))) return true;
    return false;
  });

  const summary = clients.reduce(
    (acc, c) => {
      const cStatus = c.client_status ?? (c.status === "inativo" ? "inativo" : "ativo");
      const fStatus = c.financial_status ?? (c.status === "inadimplente" ? "inadimplente" : "em_dia");
      if (cStatus === "ativo") acc.ativos += 1;
      else acc.inativos += 1;
      if (fStatus === "inadimplente") acc.inadimplentes += 1;
      else acc.emDia += 1;
      return acc;
    },
    { ativos: 0, inativos: 0, inadimplentes: 0, emDia: 0 },
  );

  const handleSubmit = (data: ClientFormState) => {
    const payload: Partial<ClientRow> = {
      ...data,
      logo_url: data.logo_url.trim() || null,
      brand_color: data.brand_color.trim() || null,
    };
    if (editing) update.mutate({ id: editing.id, payload });
    else create.mutate(payload);
  };

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${clients.length} cadastrado(s)`}
        actions={
          <Button
            className="gap-2"
            style={{ background: "var(--gradient-primary)", color: "var(--background)" }}
            onClick={() => { setEditing(null); setOpen(true); }}
          >
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        }
      />

      <Sheet open={open} onOpenChange={(v) => (v ? setOpen(true) : closeSheet())}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Editar cliente" : "Novo cliente"}</SheetTitle>
          </SheetHeader>
          <ClientForm
            initial={editing}
            onSubmit={handleSubmit}
            loading={create.isPending || update.isPending}
            submitLabel={editing ? "Salvar alterações" : "Cadastrar cliente"}
          />
        </SheetContent>
      </Sheet>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard label="Total" value={clients.length} />
        <SummaryCard label="Ativos" value={summary.ativos} tone="success" />
        <SummaryCard label="Inativos" value={summary.inativos} />
        <SummaryCard label="Inadimplentes" value={summary.inadimplentes} tone="destructive" />
      </div>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, empresa, e-mail, telefone ou documento..."
            className="pl-9"
          />
        </div>
        <Select value={clientStatusFilter} onValueChange={setClientStatusFilter}>
          <SelectTrigger className="md:w-48"><SelectValue placeholder="Status do cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={financialStatusFilter} onValueChange={setFinancialStatusFilter}>
          <SelectTrigger className="md:w-52"><SelectValue placeholder="Situação financeira" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            <SelectItem value="em_dia">Em dia</SelectItem>
            <SelectItem value="inadimplente">Inadimplentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nenhum cliente"
          description="Cadastre seu primeiro cliente para começar a controlar receitas e repasses."
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              onEdit={(client) => {
                setEditing(client as ClientRow);
                setOpen(true);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}


function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" }) {
  const cls =
    tone === "success" ? "text-[color:var(--success)]" :
    tone === "destructive" ? "text-[color:var(--destructive)]" : "";
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-bold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
