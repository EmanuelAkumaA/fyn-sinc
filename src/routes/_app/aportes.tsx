import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui-helpers";
import { MetricCard } from "@/components/metric-card";
import { formatBRL, formatDate, getCurrentOrgId, PLATFORMS } from "@/lib/fynsinc";

function usePlatforms() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["platforms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platforms").select("id, name").order("name");
      if (error) throw error;
      if (!data || data.length === 0) {
        const org = await getCurrentOrgId();
        if (org) {
          await supabase.from("platforms").insert(PLATFORMS.map((name) => ({ organization_id: org, name })));
          const reload = await supabase.from("platforms").select("id, name").order("name");
          return reload.data ?? [];
        }
      }
      return data ?? [];
    },
  });
  const create = useMutation({
    mutationFn: async (name: string) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Sem organização");
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Informe um nome");
      const { error } = await supabase.from("platforms").insert({ organization_id: org, name: trimmed });
      if (error) {
        if (error.code === "23505") throw new Error("Esta plataforma já existe");
        throw error;
      }
      return trimmed;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platforms"] }),
  });
  return { platforms: (query.data ?? []) as { id: string; name: string }[], create };
}

function PlatformSelect({ value, onChange, includeAll = false }: { value: string; onChange: (v: string) => void; includeAll?: boolean }) {
  const { platforms, create } = usePlatforms();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const handleCreate = async () => {
    try {
      const created = await create.mutateAsync(name);
      onChange(created);
      setName("");
      setOpen(false);
      toast.success("Plataforma adicionada");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === "__new__") {
            setOpen(true);
            return;
          }
          onChange(v);
        }}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {includeAll && <SelectItem value="all">Todas plataformas</SelectItem>}
          {platforms.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
          <SelectSeparator />
          <SelectItem value="__new__" className="text-primary">+ Nova plataforma</SelectItem>
        </SelectContent>
      </Select>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nova plataforma</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
              placeholder="Ex.: Pinterest Ads"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={create.isPending} style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
              {create.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const Route = createFileRoute("/_app/aportes")({
  component: AportesPage,
  head: () => ({ meta: [{ title: "Aportes & Repasses — Fyn Sinc" }] }),
});

function AportesPage() {
  const qc = useQueryClient();
  const [openAporte, setOpenAporte] = useState(false);
  const [openUso, setOpenUso] = useState(false);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: wallet = [] } = useQuery({
    queryKey: ["wallet"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_client_wallet")
        .select("*")
        .order("available_balance", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: tx = [] } = useQuery({
    queryKey: ["aportes-tx"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .in("type", ["repasse_recebido", "uso_repasse"])
        .order("paid_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });
  const { data: banks = [] } = useQuery({
    queryKey: ["banks-min"],
    queryFn: async () => (await supabase.from("banks").select("id, name").order("name")).data ?? [],
  });

  const clientById = useMemo(() => Object.fromEntries(clients.map((c: any) => [c.id, c])), [clients]);
  const bankById = useMemo(() => Object.fromEntries(banks.map((b: any) => [b.id, b])), [banks]);

  const totalAportado = wallet.reduce((s: number, w: any) => s + Number(w.total_received ?? 0), 0);
  const totalUsado = wallet.reduce((s: number, w: any) => s + Number(w.total_used ?? 0), 0);
  const saldoDisp = wallet.reduce((s: number, w: any) => s + Number(w.available_balance ?? 0), 0);
  const clientesAtivos = new Set(wallet.filter((w: any) => Number(w.available_balance) > 0).map((w: any) => w.client_id)).size;

  const filteredTx = tx.filter((t: any) => {
    if (clientFilter !== "all" && t.client_id !== clientFilter) return false;
    if (platformFilter !== "all" && t.platform !== platformFilter) return false;
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const cli = clientById[t.client_id]?.name?.toLowerCase() ?? "";
      if (!t.description?.toLowerCase().includes(s) && !cli.includes(s)) return false;
    }
    return true;
  });

  const filteredWallet = wallet.filter((w: any) => {
    if (clientFilter !== "all" && w.client_id !== clientFilter) return false;
    if (platformFilter !== "all" && w.platform !== platformFilter) return false;
    return true;
  });

  const createAporte = useMutation({
    mutationFn: async (p: any) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Sem organização");
      const amt = Number(p.amount);
      const { error } = await supabase.from("financial_transactions").insert({
        organization_id: org,
        type: "repasse_recebido",
        status: "pago",
        description: p.description,
        amount_gross: amt,
        amount_net: amt,
        due_date: p.date,
        paid_at: p.date,
        client_id: p.client_id,
        bank_id: p.bank_id,
        platform: p.platform,
        notes: p.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aporte registrado");
      qc.invalidateQueries();
      setOpenAporte(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createUso = useMutation({
    mutationFn: async (p: any) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Sem organização");
      const amt = Number(p.amount);
      // Valida saldo
      const w = wallet.find((x: any) => x.client_id === p.client_id && x.platform === p.platform);
      const avail = Number(w?.available_balance ?? 0);
      if (amt > avail) throw new Error("Saldo insuficiente para esta plataforma. Registre um novo aporte antes de usar esse valor.");

      const cashbackExp = Number(p.cashback_expected || 0);
      const { error } = await supabase.from("financial_transactions").insert({
        organization_id: org,
        type: "uso_repasse",
        status: "pago",
        description: p.description,
        amount_gross: amt,
        amount_net: amt,
        due_date: p.date,
        paid_at: p.date,
        client_id: p.client_id,
        bank_id: p.bank_id,
        platform: p.platform,
        fornecedor: p.fornecedor || null,
        notes: p.notes || null,
        cashback_expected: cashbackExp,
        cashback_status: cashbackExp > 0 ? "pendente" : "nenhum",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Uso de aporte registrado");
      qc.invalidateQueries();
      setOpenUso(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [cashbackTx, setCashbackTx] = useState<any>(null);
  const receiveCashback = useMutation({
    mutationFn: async (p: { tx: any; amount: number; date: string; bank_id: string }) => {
      const org = await getCurrentOrgId();
      if (!org) throw new Error("Sem organização");
      const { error } = await supabase
        .from("financial_transactions")
        .update({
          cashback_received: p.amount,
          cashback_received_at: p.date,
          cashback_bank_id: p.bank_id,
          cashback_status: "recebido",
        })
        .eq("id", p.tx.id);
      if (error) throw error;
      const { error: e2 } = await supabase.from("financial_transactions").insert({
        organization_id: org,
        type: "cashback",
        status: "pago",
        description: `Cashback — ${p.tx.description}`,
        amount_gross: p.amount,
        amount_net: p.amount,
        due_date: p.date,
        paid_at: p.date,
        client_id: p.tx.client_id,
        bank_id: p.bank_id,
        platform: p.tx.platform,
        category: "cashback",
        notes: `Cashback referente ao uso de aporte ${p.tx.id}`,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Cashback recebido");
      qc.invalidateQueries();
      setCashbackTx(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cashbackPendente = tx.reduce((s: number, t: any) => {
    if (t.type === "uso_repasse" && t.cashback_status === "pendente") {
      return s + (Number(t.cashback_expected) - Number(t.cashback_received || 0));
    }
    return s;
  }, 0);

  return (
    <>
      <PageHeader
        title="Aportes & Repasses"
        subtitle="Dinheiro do cliente em custódia para mídia e ferramentas"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setOpenUso(true)}>
              <ArrowUpFromLine className="h-4 w-4" /> Usar aporte
            </Button>
            <Button className="gap-2" style={{ background: "var(--gradient-primary)", color: "var(--background)" }} onClick={() => setOpenAporte(true)}>
              <Plus className="h-4 w-4" /> Novo aporte
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total aportado" value={formatBRL(totalAportado)} tone="success" />
        <MetricCard label="Total utilizado" value={formatBRL(totalUsado)} tone="destructive" />
        <MetricCard label="Saldo disponível" value={formatBRL(saldoDisp)} tone="primary" />
        <MetricCard label="Clientes c/ saldo" value={String(clientesAtivos)} />
      </div>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9" />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos clientes</SelectItem>
            {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="md:w-40">
          <PlatformSelect value={platformFilter} onChange={setPlatformFilter} includeAll />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="repasse_recebido">Aporte recebido</SelectItem>
            <SelectItem value="uso_repasse">Uso de aporte</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="saldos" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="saldos">Saldos por cliente</TabsTrigger>
          <TabsTrigger value="movs">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="saldos">
          {filteredWallet.length === 0 ? (
            <EmptyState icon={<ArrowLeftRight className="h-6 w-6" />} title="Sem saldos" description="Registre o primeiro aporte para acompanhar o saldo do cliente." />
          ) : (
            <div className="space-y-2">
              {filteredWallet.map((w: any) => (
                <div key={`${w.client_id}-${w.platform}`} className="glass rounded-2xl p-4 flex flex-col md:grid md:grid-cols-5 gap-3 md:items-center">
                  <div className="md:col-span-2 min-w-0">
                    <div className="font-medium truncate">{w.client_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{w.platform}</div>
                  </div>
                  <div className="flex items-end justify-between gap-3 md:contents">
                    <div className="text-xs min-w-0">
                      <div className="text-muted-foreground">Aportado</div>
                      <div className="font-medium text-[color:var(--success)] truncate">{formatBRL(w.total_received)}</div>
                    </div>
                    <div className="text-xs min-w-0">
                      <div className="text-muted-foreground">Utilizado</div>
                      <div className="font-medium text-[color:var(--destructive)] truncate">{formatBRL(w.total_used)}</div>
                    </div>
                    <div className="text-right min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo</div>
                      <div className="font-display font-bold text-lg text-primary truncate">{formatBRL(w.available_balance)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="movs">
          {filteredTx.length === 0 ? (
            <EmptyState icon={<ArrowLeftRight className="h-6 w-6" />} title="Sem movimentações" description="Nenhum aporte ou uso registrado ainda." />
          ) : (
            <div className="space-y-2">
              {filteredTx.map((t: any) => {
                const isAporte = t.type === "repasse_recebido";
                return (
                  <div key={t.id} className="glass rounded-2xl p-4 flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isAporte ? "bg-[color:var(--success)]/15 text-[color:var(--success)]" : "bg-[color:var(--destructive)]/15 text-[color:var(--destructive)]"}`}>
                      {isAporte ? <ArrowDownToLine className="h-5 w-5" /> : <ArrowUpFromLine className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{t.description}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>{isAporte ? "Aporte recebido" : "Uso de aporte"}</span>
                        <span>·</span>
                        <span>{clientById[t.client_id]?.name ?? "—"}</span>
                        {t.platform && <><span>·</span><span>{t.platform}</span></>}
                        {t.fornecedor && <><span>·</span><span>{t.fornecedor}</span></>}
                        <span>·</span>
                        <span>{formatDate(t.paid_at ?? t.due_date)}</span>
                        {t.bank_id && <><span>·</span><span>{bankById[t.bank_id]?.name}</span></>}
                      </div>
                    </div>
                    <div className={`font-display font-semibold ${isAporte ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]"}`}>
                      {isAporte ? "+" : "−"} {formatBRL(t.amount_gross)}
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={openAporte} onOpenChange={setOpenAporte}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Novo aporte</SheetTitle></SheetHeader>
          <AporteForm clients={clients} banks={banks} onSubmit={(d: any) => createAporte.mutate(d)} loading={createAporte.isPending} />
        </SheetContent>
      </Sheet>

      <Sheet open={openUso} onOpenChange={setOpenUso}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Usar aporte</SheetTitle></SheetHeader>
          <UsoForm clients={clients} banks={banks} wallet={wallet} onSubmit={(d: any) => createUso.mutate(d)} loading={createUso.isPending} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function AporteForm({ clients, banks, onSubmit, loading }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    client_id: "",
    bank_id: "",
    platform: "Meta Ads",
    amount: "",
    date: today,
    description: "",
    notes: "",
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.client_id) return toast.error("Selecione um cliente");
        if (!form.bank_id) return toast.error("Selecione o banco de destino");
        if (!form.amount || Number(form.amount) <= 0) return toast.error("Valor inválido");
        onSubmit(form);
      }}
      className="space-y-4 mt-6"
    >
      <div className="space-y-2">
        <Label>Cliente *</Label>
        <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
          <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Banco de destino *</Label>
        <Select value={form.bank_id} onValueChange={(v) => setForm({ ...form, bank_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecionar banco" /></SelectTrigger>
          <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Plataforma *</Label>
        <PlatformSelect value={form.platform} onChange={(v) => setForm({ ...form, platform: v })} />

      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Valor *</Label><Input required type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        <div className="space-y-2"><Label>Data *</Label><Input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
      </div>
      <div className="space-y-2"><Label>Descrição *</Label><Input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Aporte para mídia outubro" /></div>
      <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
      <Button type="submit" disabled={loading} className="w-full" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
        {loading ? "Salvando..." : "Registrar aporte"}
      </Button>
    </form>
  );
}

function UsoForm({ clients, banks, wallet, onSubmit, loading }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    client_id: "",
    platform: "Meta Ads",
    bank_id: "",
    fornecedor: "",
    amount: "",
    date: today,
    description: "",
    notes: "",
  });

  const saldo = useMemo(() => {
    const w = wallet.find((x: any) => x.client_id === form.client_id && x.platform === form.platform);
    return Number(w?.available_balance ?? 0);
  }, [wallet, form.client_id, form.platform]);

  const amtNum = Number(form.amount || 0);
  const insuficiente = !!form.client_id && amtNum > saldo;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.client_id) return toast.error("Selecione um cliente");
        if (!form.bank_id) return toast.error("Selecione o banco de origem");
        if (!form.amount || amtNum <= 0) return toast.error("Valor inválido");
        if (insuficiente) return toast.error("Saldo insuficiente para esta plataforma. Registre um novo aporte antes de usar esse valor.");
        onSubmit(form);
      }}
      className="space-y-4 mt-6"
    >
      <div className="space-y-2">
        <Label>Cliente *</Label>
        <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
          <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Plataforma *</Label>
        <PlatformSelect value={form.platform} onChange={(v) => setForm({ ...form, platform: v })} />

      </div>
      {form.client_id && (
        <div className={`rounded-xl px-3 py-2.5 text-sm flex items-center justify-between ${insuficiente ? "bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]" : "bg-secondary/40"}`}>
          <span className="text-muted-foreground">Saldo disponível</span>
          <span className="font-display font-semibold">{formatBRL(saldo)}</span>
        </div>
      )}
      <div className="space-y-2">
        <Label>Banco de origem *</Label>
        <Select value={form.bank_id} onValueChange={(v) => setForm({ ...form, bank_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecionar banco" /></SelectTrigger>
          <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Fornecedor</Label><Input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} placeholder="Ex.: Google Ads, Meta Ads, Kommo" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Valor *</Label><Input required type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        <div className="space-y-2"><Label>Data *</Label><Input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
      </div>
      <div className="space-y-2"><Label>Descrição *</Label><Input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Pagamento Meta Ads outubro" /></div>
      <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
      <Button type="submit" disabled={loading || insuficiente} className="w-full" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
        {loading ? "Salvando..." : "Registrar uso"}
      </Button>
    </form>
  );
}
