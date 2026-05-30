import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { providerSchema, PROVIDER_TYPE_LABELS, type ProviderType } from "@/lib/providers";

export type ProviderRecord = {
  id?: string;
  name: string;
  provider_type: ProviderType;
  document: string | null;
  email: string | null;
  phone: string | null;
  pix_key: string | null;
  payment_notes: string | null;
  status: "ativo" | "inativo";
  notes: string | null;
};

export function ProviderForm({
  initial,
  loading,
  onSubmit,
}: {
  initial: Partial<ProviderRecord> | null;
  loading: boolean;
  onSubmit: (data: ProviderRecord) => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    provider_type: (initial?.provider_type ?? "freelancer") as ProviderType,
    document: initial?.document ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    pix_key: initial?.pix_key ?? "",
    payment_notes: initial?.payment_notes ?? "",
    status: (initial?.status ?? "ativo") as "ativo" | "inativo",
    notes: initial?.notes ?? "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = providerSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    onSubmit({
      ...form,
      document: form.document || null,
      email: form.email || null,
      phone: form.phone || null,
      pix_key: form.pix_key || null,
      payment_notes: form.payment_notes || null,
      notes: form.notes || null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 mt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2 md:col-span-2">
          <Label>Nome *</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Tipo *</Label>
          <Select value={form.provider_type} onValueChange={(v) => setForm({ ...form, provider_type: v as ProviderType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PROVIDER_TYPE_LABELS) as ProviderType[]).map((k) => (
                <SelectItem key={k} value={k}>{PROVIDER_TYPE_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "ativo" | "inativo" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>CPF/CNPJ</Label>
          <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Chave Pix</Label>
          <Input value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Observações de pagamento</Label>
        <Textarea rows={2} value={form.payment_notes} onChange={(e) => setForm({ ...form, payment_notes: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Observações internas</Label>
        <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <Button type="submit" disabled={loading} className="w-full" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
        {loading ? "Salvando..." : "Salvar prestador"}
      </Button>
    </form>
  );
}
