import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader, EmptyState } from "@/components/ui-helpers";
import { getCurrentOrgId } from "@/lib/fynsinc";
import { ClientCard } from "@/components/client-card";
import { ClientLogoUpload } from "@/components/client-logo-upload";
import { DEFAULT_BRAND_COLOR, isValidHex } from "@/lib/client-brand";
import { maskDocument, maskPhone, isValidDocument, isValidPhone, isValidEmail } from "@/lib/masks";


export const Route = createFileRoute("/_app/clientes")({
  component: ClientesPage,
  head: () => ({ meta: [{ title: "Clientes — Fyn Sinc" }] }),
});

type ClientRow = {
  id: string;
  name: string;
  type: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  status: string;
  client_status: string;
  financial_status: string;
  logo_url: string | null;
  brand_color: string | null;
};

type FormState = {
  name: string;
  type: string;
  document: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  client_status: string;
  financial_status: string;
  logo_url: string;
  brand_color: string;
};

const emptyForm: FormState = {
  name: "",
  type: "PJ",
  document: "",
  email: "",
  phone: "",
  company: "",
  notes: "",
  client_status: "ativo",
  financial_status: "em_dia",
  logo_url: "",
  brand_color: "",
};

function ClientesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
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

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleSubmit = (data: FormState) => {
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

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-9" />
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
                  status: "ativo",
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
