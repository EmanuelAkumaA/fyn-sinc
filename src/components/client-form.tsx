import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientCard } from "@/components/client-card";
import { ClientLogoUpload } from "@/components/client-logo-upload";
import { DEFAULT_BRAND_COLOR, isValidHex } from "@/lib/client-brand";
import { maskDocument, maskPhone, isValidDocument, isValidEmail, isValidPhone } from "@/lib/masks";
import { clientSchema } from "@/lib/schemas";
import { getCurrentOrgId } from "@/lib/fynsinc";

export type ClientRow = {
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

export type ClientFormState = {
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

export const emptyClientForm: ClientFormState = {
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

export function ClientForm({
  initial,
  onSubmit,
  loading,
  submitLabel,
}: {
  initial: ClientRow | null;
  onSubmit: (data: ClientFormState) => void;
  loading: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState<ClientFormState>(emptyClientForm);
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
      setForm(emptyClientForm);
      setBrandColorTouched(false);
    }
  }, [initial]);

  const colorForPicker = form.brand_color && isValidHex(form.brand_color) ? form.brand_color : DEFAULT_BRAND_COLOR;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validação Zod centralizada — falha rápida com mensagem amigável.
    const parsed = clientSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    if (form.document.trim() && !isValidDocument(form.document, form.type)) {
      toast.error(form.type === "PF" ? "CPF inválido. Use 11 dígitos." : "CNPJ inválido. Use 14 dígitos.");
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
