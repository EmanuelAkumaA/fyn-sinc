import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Banknote, Building2, Pencil, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui-helpers";
import { MetricCard } from "@/components/metric-card";
import { ClientLogo } from "@/components/client-logo";
import { ClientLogoUpload } from "@/components/client-logo-upload";
import { DEFAULT_BRAND_COLOR, getBrandColor, hexToRgba, isValidHex } from "@/lib/client-brand";
import { formatBRL, getCurrentOrgId } from "@/lib/fynsinc";
import { deriveBreakdown, type BankBreakdownRow } from "@/lib/finance";
import { BankBreakdownChips } from "@/components/bank-breakdown-chips";

export const Route = createFileRoute("/_app/bancos")({
  component: BancosPage,
  head: () => ({ meta: [{ title: "Bancos — Fyn Sinc" }] }),
});

function BancosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: banks = [], isLoading } = useQuery({
    queryKey: ["banks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banks").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: breakdown = [] } = useQuery<BankBreakdownRow[]>({
    queryKey: ["bank-breakdown"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_bank_balance_breakdown")
        .select("*")
        .order("bank_name");
      if (error) throw error;
      return (data ?? []) as BankBreakdownRow[];
    },
  });

  const breakdownById = useMemo(
    () => Object.fromEntries(breakdown.map((r) => [r.bank_id, deriveBreakdown(r)])),
    [breakdown],
  );

  const save = useMutation({
    mutationFn: async (payload: any) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Organização não encontrada");
      const data = {
        name: payload.name,
        account_type: payload.account_type || null,
        initial_balance: Number(payload.initial_balance || 0),
        color: payload.color || null,
        logo_url: payload.logo_url || null,
        status: payload.status,
      };
      const result = editing?.id
        ? await supabase.from("banks").update(data).eq("id", editing.id)
        : await supabase.from("banks").insert({ ...data, organization_id: org });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success(editing ? "Banco atualizado" : "Banco criado");
      qc.invalidateQueries({ queryKey: ["banks"] });
      qc.invalidateQueries({ queryKey: ["banks-min"] });
      qc.invalidateQueries({ queryKey: ["bank-breakdown"] });
      qc.invalidateQueries({ queryKey: ["dashboard-bank-breakdown"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = banks.filter((b: any) => b.name.toLowerCase().includes(search.toLowerCase()));
  const totalBalance = breakdown.reduce((sum, r) => sum + deriveBreakdown(r).total_balance, 0);
  const active = banks.filter((b: any) => b.status === "ativo").length;

  return (
    <>
      <PageHeader
        title="Bancos"
        subtitle="Contas operacionais e saldos consolidados"
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
            <Plus className="h-4 w-4" /> Novo banco
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <MetricCard label="Saldo consolidado" value={formatBRL(totalBalance)} hint="Saldo inicial + lançamentos pagos" icon={Banknote} tone={totalBalance >= 0 ? "success" : "destructive"} />
        <MetricCard label="Contas ativas" value={String(active)} hint={`${banks.length} cadastrada(s)`} />
        <MetricCard label="Saldo inicial" value={formatBRL(banks.reduce((sum: number, b: any) => sum + Number(b.initial_balance ?? 0), 0))} hint="Base das contas" />
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar banco..." className="pl-9" />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Building2 className="h-6 w-6" />} title="Nenhum banco" description="Cadastre contas para registrar pagamentos, taxas e transferências." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((b: any) => {
            const br = breakdownById[b.id];
            const current = br?.total_balance ?? Number(b.initial_balance ?? 0);
            const color = getBrandColor({ brand_color: b.color });
            return (
              <div
                key={b.id}
                className="client-card p-4 flex items-start gap-3"
                style={{
                  ["--client-color" as any]: color,
                  ["--client-glow" as any]: hexToRgba(color, 0.28),
                  ["--client-tint" as any]: hexToRgba(color, 0.06),
                }}
              >
                <ClientLogo client={{ name: b.name, logo_url: b.logo_url, brand_color: b.color }} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{b.name}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{b.account_type || "Conta operacional"}</div>
                  <div className="font-display text-2xl font-semibold mt-3">{formatBRL(current)}</div>
                  <BankBreakdownChips
                    kuma={br?.kuma_balance ?? 0}
                    cliente={br?.client_funds_balance ?? 0}
                    cashback={br?.cashback_total ?? 0}
                    taxas={br?.fees_total ?? 0}
                  />
                </div>
                <Button size="icon" variant="ghost" onClick={() => { setEditing(b); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? "Editar banco" : "Novo banco"}</SheetTitle></SheetHeader>
          <BankForm initial={editing} loading={save.isPending} onSubmit={(data) => save.mutate(data)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function BankForm({ initial, loading, onSubmit }: { initial: any | null; loading: boolean; onSubmit: (data: any) => void }) {
  const [orgId, setOrgId] = useState<string | null>(null);
  useEffect(() => { getCurrentOrgId().then(setOrgId); }, []);

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    account_type: initial?.account_type ?? "",
    initial_balance: initial?.initial_balance?.toString() ?? "0",
    color: initial?.color ?? "",
    logo_url: initial?.logo_url ?? "",
    status: initial?.status ?? "ativo",
  });

  const colorInvalid = form.color.trim() !== "" && !isValidHex(form.color);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4 mt-6">
      <div className="space-y-2"><Label>Nome *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="space-y-2"><Label>Tipo de conta</Label><Input value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })} placeholder="Conta corrente, gateway, carteira..." /></div>
      <div className="space-y-2"><Label>Saldo inicial</Label><Input type="number" step="0.01" value={form.initial_balance} onChange={(e) => setForm({ ...form, initial_balance: e.target.value })} /></div>

      <div className="space-y-2">
        <Label>Logo</Label>
        <ClientLogoUpload
          value={form.logo_url}
          orgId={orgId}
          bucket="bank-logos"
          onChange={(url, extractedColor) =>
            setForm((f) => ({ ...f, logo_url: url, color: extractedColor ?? f.color }))
          }
          onRemove={() => setForm((f) => ({ ...f, logo_url: "", color: "" }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Cor (HEX)</Label>
          <div className="flex items-center gap-2">
            <span
              className="h-9 w-9 rounded-md border border-input shrink-0"
              style={{ background: isValidHex(form.color) ? form.color : DEFAULT_BRAND_COLOR }}
            />
            <Input
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              placeholder="#14B8A6"
              maxLength={7}
            />
          </div>
          {colorInvalid && <p className="text-xs text-destructive">Use formato HEX, ex.: #14B8A6</p>}
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
      <Button type="submit" disabled={loading || colorInvalid} className="w-full" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
        {loading ? "Salvando..." : "Salvar banco"}
      </Button>
    </form>
  );
}
