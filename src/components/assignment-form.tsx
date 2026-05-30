import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  assignmentSchema,
  ASSIGNMENT_TYPE_LABELS,
  COMPENSATION_TYPE_LABELS,
  computeProviderCost,
  fetchAssignmentExpectedRevenue,
  type AssignmentType,
  type CompensationType,
} from "@/lib/providers";
import { FREQUENCY_LABELS, type ExpenseFrequency } from "@/lib/expenses";
import { formatBRL } from "@/lib/fynsinc";

export type AssignmentRecord = {
  id?: string;
  provider_id: string;
  client_id: string | null;
  service_id: string | null;
  client_recurring_contract_id: string | null;
  assignment_type: AssignmentType;
  compensation_type: CompensationType;
  fixed_amount: number | null;
  percentage: number | null;
  frequency: ExpenseFrequency | null;
  start_date: string;
  end_date: string | null;
  status: "ativo" | "pausado" | "encerrado" | "cancelado";
  notes: string | null;
};

const FREQS: ExpenseFrequency[] = ["unica", "semanal", "quinzenal", "mensal", "bimestral", "trimestral", "semestral", "anual"];

export function AssignmentForm({
  providerId,
  initial,
  loading,
  onSubmit,
}: {
  providerId: string;
  initial: Partial<AssignmentRecord> | null;
  loading: boolean;
  onSubmit: (data: AssignmentRecord) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    client_id: initial?.client_id ?? "",
    service_id: initial?.service_id ?? "",
    client_recurring_contract_id: initial?.client_recurring_contract_id ?? "",
    assignment_type: (initial?.assignment_type ?? "recorrente") as AssignmentType,
    compensation_type: (initial?.compensation_type ?? "valor_fixo") as CompensationType,
    fixed_amount: initial?.fixed_amount?.toString() ?? "",
    percentage: initial?.percentage?.toString() ?? "",
    frequency: (initial?.frequency ?? "mensal") as ExpenseFrequency,
    start_date: initial?.start_date ?? today,
    end_date: initial?.end_date ?? "",
    status: (initial?.status ?? "ativo") as AssignmentRecord["status"],
    notes: initial?.notes ?? "",
    manual_revenue: "",
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });
  const { data: services = [] } = useQuery({
    queryKey: ["services-min"],
    queryFn: async () => (await supabase.from("services").select("id, name, default_value").order("name")).data ?? [],
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["recurring-by-client", form.client_id],
    enabled: !!form.client_id,
    queryFn: async () =>
      (await supabase
        .from("recurring_contracts")
        .select("id, description, amount, service_id")
        .eq("client_id", form.client_id)
        .order("created_at", { ascending: false })).data ?? [],
  });

  const [expectedRevenue, setExpectedRevenue] = useState(0);
  useEffect(() => {
    let active = true;
    fetchAssignmentExpectedRevenue({
      recurring_contract_id: form.client_recurring_contract_id || null,
      service_id: form.service_id || null,
    }).then((r) => {
      if (active) setExpectedRevenue(r);
    });
    return () => { active = false; };
  }, [form.client_recurring_contract_id, form.service_id]);

  const revenue = useMemo(() => {
    const manual = Number(form.manual_revenue || 0);
    return manual > 0 ? manual : expectedRevenue;
  }, [form.manual_revenue, expectedRevenue]);

  const cost = computeProviderCost(
    form.compensation_type,
    Number(form.fixed_amount || 0),
    Number(form.percentage || 0),
    revenue,
  );
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: AssignmentRecord = {
      provider_id: providerId,
      client_id: form.client_id || null,
      service_id: form.service_id || null,
      client_recurring_contract_id: form.client_recurring_contract_id || null,
      assignment_type: form.assignment_type,
      compensation_type: form.compensation_type,
      fixed_amount: form.compensation_type === "valor_fixo" ? Number(form.fixed_amount || 0) : null,
      percentage: form.compensation_type === "porcentagem" ? Number(form.percentage || 0) : null,
      frequency: form.assignment_type === "recorrente" ? form.frequency : "unica",
      start_date: form.start_date,
      end_date: form.end_date || null,
      status: form.status,
      notes: form.notes || null,
    };
    const parsed = assignmentSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    onSubmit(payload);
  }

  return (
    <form onSubmit={submit} className="space-y-4 mt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Cliente</Label>
          <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v, client_recurring_contract_id: "" })}>
            <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem cliente</SelectItem>
              {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Serviço</Label>
          <Select value={form.service_id || "none"} onValueChange={(v) => setForm({ ...form, service_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem serviço</SelectItem>
              {services.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {form.client_id && contracts.length > 0 && (
          <div className="space-y-2 md:col-span-2">
            <Label>Contrato recorrente do cliente</Label>
            <Select value={form.client_recurring_contract_id || "none"} onValueChange={(v) => setForm({ ...form, client_recurring_contract_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem contrato</SelectItem>
                {contracts.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.description ?? "Contrato"} — {formatBRL(c.amount)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Tipo *</Label>
          <Select value={form.assignment_type} onValueChange={(v) => setForm({ ...form, assignment_type: v as AssignmentType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(ASSIGNMENT_TYPE_LABELS) as AssignmentType[]).map((k) => (
                <SelectItem key={k} value={k}>{ASSIGNMENT_TYPE_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Remuneração *</Label>
          <Select value={form.compensation_type} onValueChange={(v) => setForm({ ...form, compensation_type: v as CompensationType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(COMPENSATION_TYPE_LABELS) as CompensationType[]).map((k) => (
                <SelectItem key={k} value={k}>{COMPENSATION_TYPE_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.compensation_type === "valor_fixo" ? (
          <div className="space-y-2">
            <Label>Valor fixo (R$) *</Label>
            <CurrencyInput value={form.fixed_amount} onValueChange={(v) => setForm({ ...form, fixed_amount: v })} />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Percentual (%) *</Label>
            <Input type="number" step="0.01" min="0" max="100" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} />
          </div>
        )}
        {form.assignment_type === "recorrente" && (
          <div className="space-y-2">
            <Label>Frequência</Label>
            <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as ExpenseFrequency })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQS.filter((f) => f !== "unica").map((f) => (
                  <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Data inicial *</Label>
          <Input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Data final</Label>
          <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as AssignmentRecord["status"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="pausado">Pausado</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {expectedRevenue === 0 && (form.compensation_type === "porcentagem" || true) && (
        <div className="space-y-2">
          <Label>Receita estimada do cliente (simulação)</Label>
          <CurrencyInput placeholder="Opcional, apenas para preview" value={form.manual_revenue} onValueChange={(v) => setForm({ ...form, manual_revenue: v })} />
        </div>
      )}

      <div className="glass rounded-2xl p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Preview label="Receita prevista" value={formatBRL(revenue)} />
        <Preview label="Custo prestador" value={formatBRL(cost)} />
        <Preview label="Lucro previsto" value={formatBRL(profit)} tone={profit >= 0 ? "success" : "destructive"} />
        <Preview label="Margem" value={`${margin.toFixed(1)}%`} tone={margin >= 0 ? "success" : "destructive"} />
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <Button type="submit" disabled={loading} className="w-full" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
        {loading ? "Salvando..." : "Salvar vínculo"}
      </Button>
    </form>
  );
}

function Preview({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  const cls = tone === "success" ? "text-[color:var(--success)]" : tone === "destructive" ? "text-[color:var(--destructive)]" : "text-foreground";
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`font-medium ${cls}`}>{value}</div>
    </div>
  );
}
