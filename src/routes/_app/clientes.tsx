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
import { PageHeader, EmptyState } from "@/components/ui-helpers";
import { getCurrentOrgId } from "@/lib/fynsinc";
import { ClientCard } from "@/components/client-card";
import { ClientForm, type ClientRow, type ClientFormState } from "@/components/client-form";

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

function ClientForm({
  initial,
  onSubmit,
  loading,
  submitLabel,
}: {
  initial: ClientRow | null;
  onSubmit: (data: FormState) => void;
  loading: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [brandColorTouched, setBrandColorTouched] = useState(false);

  useEffect(() => {
    getCurrentOrgId().then(setOrgId).catch(() => setOrgId(null));
  }, []);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name ?? "",
        type: initial.type ?? "PJ",
        document: initial.document ? maskDocument(initial.document, initial.type ?? "PJ") : "",
        email: initial.email ?? "",
        phone: initial.phone ? maskPhone(initial.phone) : "",
        company: initial.company ?? "",
        notes: initial.notes ?? "",
        client_status: initial.client_status ?? (initial.status === "inativo" ? "inativo" : "ativo"),
        financial_status: initial.financial_status ?? (initial.status === "inadimplente" ? "inadimplente" : "em_dia"),
        logo_url: initial.logo_url ?? "",
        brand_color: initial.brand_color ?? "",
      });
      setBrandColorTouched(Boolean(initial.brand_color));
    } else {
      setForm(emptyForm);
      setBrandColorTouched(false);
    }
  }, [initial]);

  const colorForPicker = form.brand_color && isValidHex(form.brand_color) ? form.brand_color : DEFAULT_BRAND_COLOR;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.brand_color.trim() && !isValidHex(form.brand_color.trim())) {
      toast.error("Cor da marca inválida. Use o formato HEX (ex.: #14B8A6).");
      return;
    }
    if (form.document.trim() && !isValidDocument(form.document, form.type)) {
      toast.error(form.type === "PF" ? "CPF inválido. Use 11 dígitos." : "CNPJ inválido. Use 14 dígitos.");
      return;
    }
    if (form.email.trim() && !isValidEmail(form.email)) {
      toast.error("E-mail inválido.");
      return;
    }
    if (form.phone.trim() && !isValidPhone(form.phone)) {
      toast.error("Telefone inválido. Use DDD + número (10 ou 11 dígitos).");
      return;
    }
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-6 pb-8">
      <div className="space-y-2">
        <Label>Nome da Empresa *</Label>
        <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select
            value={form.type}
            onValueChange={(v) =>
              setForm((prev) => ({ ...prev, type: v, document: prev.document ? maskDocument(prev.document, v) : "" }))
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PJ">Pessoa jurídica</SelectItem>
              <SelectItem value="PF">Pessoa física</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>CPF/CNPJ</Label>
          <Input
            value={form.document}
            onChange={(e) => setForm({ ...form, document: maskDocument(e.target.value, form.type) })}
            inputMode="numeric"
            maxLength={form.type === "PF" ? 14 : 18}
            placeholder={form.type === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Status do cliente</Label>
          <Select value={form.client_status} onValueChange={(v) => setForm({ ...form, client_status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Situação financeira</Label>
          <Select value={form.financial_status} onValueChange={(v) => setForm({ ...form, financial_status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="em_dia">Em dia</SelectItem>
              <SelectItem value="inadimplente">Inadimplente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>E-mail</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="nome@empresa.com"
        />
      </div>
      <div className="space-y-2">
        <Label>Telefone</Label>
        <Input
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
          inputMode="tel"
          maxLength={15}
          placeholder="(00) 00000-0000"
        />
      </div>
      <div className="space-y-2">
        <Label>Empresa / Responsável</Label>
        <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
      </div>

      <div className="pt-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Identidade visual do cliente
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Logo do cliente</Label>
            <ClientLogoUpload
              value={form.logo_url}
              orgId={orgId}
              onChange={(url, extractedColor) => {
                setForm((prev) => ({
                  ...prev,
                  logo_url: url,
                  brand_color:
                    extractedColor && !brandColorTouched ? extractedColor : prev.brand_color,
                }));
              }}
              onRemove={() => setForm((prev) => ({ ...prev, logo_url: "" }))}
            />
            <Input
              type="url"
              placeholder="ou cole uma URL: https://exemplo.com/logo.png"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              className="text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Envie do dispositivo ou cole uma URL. A cor da marca é extraída automaticamente.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Cor da marca</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorForPicker}
                onChange={(e) => {
                  setBrandColorTouched(true);
                  setForm({ ...form, brand_color: e.target.value.toUpperCase() });
                }}
                className="h-10 w-12 rounded-md border border-input bg-transparent cursor-pointer"
                aria-label="Seletor de cor"
              />
              <Input
                placeholder="#14B8A6"
                value={form.brand_color}
                onChange={(e) => {
                  setBrandColorTouched(true);
                  setForm({ ...form, brand_color: e.target.value });
                }}
                className="flex-1 font-mono"
              />
              <div
                className="h-10 w-10 rounded-md border border-input shrink-0"
                style={{ background: colorForPicker }}
                aria-hidden
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Editar manualmente sobrescreve a cor automática da logo.
            </p>
          </div>

          {form.name && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
              <ClientCard
                client={{
                  id: "preview",
                  name: form.name,
                  email: form.email || null,
                  phone: form.phone || null,
                  company: form.company || null,
                  client_status: form.client_status,
                  financial_status: form.financial_status,
                  logo_url: form.logo_url || null,
                  brand_color: form.brand_color || null,
                }}
              />
            </div>
          )}
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full"
        style={{ background: "var(--gradient-primary)", color: "var(--background)" }}
      >
        {loading ? "Salvando..." : submitLabel}
      </Button>
    </form>
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
