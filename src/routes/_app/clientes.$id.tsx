import type { CSSProperties } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle, FileText, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, EmptyState, ClientStatusBadge, FinancialStatusBadge } from "@/components/ui-helpers";
import { formatBRL, formatDate } from "@/lib/fynsinc";
import { ClientLogo } from "@/components/client-logo";
import { getBrandColor, hexToRgba } from "@/lib/client-brand";

export const Route = createFileRoute("/_app/clientes/$id")({
  component: ClienteDetalhe,
});

function ClienteDetalhe() {
  const { id } = Route.useParams();

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: tx = [] } = useQuery({
    queryKey: ["client-tx", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .eq("client_id", id)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["client-plans", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("third_party_plans").select("*").eq("client_id", id);
      if (error) throw error;
      return data;
    },
  });

  const sum = (filter: (t: any) => boolean) => tx.filter(filter).reduce((s, t) => s + Number(t.amount_gross), 0);
  const receitaPropria = sum((t) => ["receita_propria", "comissao", "cashback"].includes(t.type) && t.status === "pago");
  const aberto = sum((t) => t.type === "receita_propria" && t.status === "pendente");
  const today = new Date().toISOString().slice(0, 10);
  const atrasado = sum((t) => t.type === "receita_propria" && t.status === "pendente" && t.due_date && t.due_date < today);
  const repasseRecebido = sum((t) => t.type === "repasse_recebido" && t.status === "pago");
  const repasseUsado = sum((t) => t.type === "uso_repasse" && t.status === "pago");
  const saldoRepasse = repasseRecebido - repasseUsado;
  const comissoes = sum((t) => t.type === "comissao" && t.status === "pago");
  const cashbacks = sum((t) => t.type === "cashback" && t.status === "pago");

  const aportes = tx.filter((t) => ["repasse_recebido", "uso_repasse"].includes(t.type));
  const movimentacoes = tx.filter((t) => !["repasse_recebido", "uso_repasse"].includes(t.type));

  // saldo por plataforma
  const byPlatform = new Map<string, { rec: number; uso: number }>();
  aportes.forEach((t) => {
    const k = t.platform || "Sem plataforma";
    const e = byPlatform.get(k) || { rec: 0, uso: 0 };
    if (t.type === "repasse_recebido") e.rec += Number(t.amount_gross);
    else e.uso += Number(t.amount_gross);
    byPlatform.set(k, e);
  });

  if (!client) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <>
      <Link to="/clientes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>
      {(() => {
        const color = getBrandColor(client);
        const style = {
          "--client-color": color,
          "--client-glow": hexToRgba(color, 0.22),
          "--client-tint": hexToRgba(color, 0.08),
        } as CSSProperties;
        return (
          <header className="client-header p-5 md:p-6 mb-6" style={style}>
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <ClientLogo client={client} size="lg" glow />
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-2xl md:text-3xl font-bold truncate">{client.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {client.type}{client.document && ` · ${client.document}`}
                  {client.company && ` · ${client.company}`}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {client.phone && (
                    <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {client.phone}</span>
                  )}
                  {client.email && (
                    <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {client.email}</span>
                  )}
                </div>
              </div>
              <div className="shrink-0"><StatusBadge status={client.status} /></div>
            </div>
          </header>
        );
      })()}

      <Tabs defaultValue="overview">
        <TabsList className="bg-secondary/40 mb-4 overflow-x-auto justify-start">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="aportes">Aportes</TabsTrigger>
          <TabsTrigger value="planos">Planos</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Mini label="Receita gerada" value={formatBRL(receitaPropria)} tone="success" />
            <Mini label="A receber" value={formatBRL(aberto)} />
            <Mini label="Atrasado" value={formatBRL(atrasado)} tone="destructive" />
            <Mini label="Saldo de repasse" value={formatBRL(saldoRepasse)} tone="primary" />
            <Mini label="Comissões" value={formatBRL(comissoes)} tone="success" />
            <Mini label="Cashback" value={formatBRL(cashbacks)} tone="success" />
          </div>
          {client.notes && (
            <div className="glass rounded-2xl p-5">
              <h3 className="font-display font-semibold mb-2">Observações</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="aportes">
          {aportes.length === 0 ? (
            <EmptyState title="Sem aportes" description="Os repasses recebidos e usos aparecerão aqui." />
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                {[...byPlatform.entries()].map(([plat, v]) => (
                  <div key={plat} className="glass rounded-2xl p-4">
                    <div className="text-xs uppercase text-muted-foreground">{plat}</div>
                    <div className="font-display text-xl font-bold mt-1 text-primary">{formatBRL(v.rec - v.uso)}</div>
                    <div className="text-xs text-muted-foreground">recebido {formatBRL(v.rec)} · usado {formatBRL(v.uso)}</div>
                  </div>
                ))}
              </div>
              <TxList list={aportes} />
            </>
          )}
        </TabsContent>

        <TabsContent value="planos">
          {plans.length === 0 ? (
            <EmptyState title="Sem planos/ferramentas" />
          ) : (
            <div className="grid gap-3">
              {plans.map((p) => (
                <div key={p.id} className="glass rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium">{p.plan_name} <span className="text-muted-foreground text-sm">· {p.fornecedor}</span></div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground mt-2">
                    <div>Cliente: <span className="text-foreground font-medium">{formatBRL(p.amount_received_from_client)}</span></div>
                    <div>Fornecedor: <span className="text-foreground font-medium">{formatBRL(p.amount_paid_to_supplier)}</span></div>
                    <div>Comissão: <span className="text-[color:var(--success)] font-medium">{formatBRL(p.commission_value)}</span></div>
                    <div>Cashback: <span className="text-[color:var(--success)] font-medium">{formatBRL(p.cashback_received)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="financeiro">
          {movimentacoes.length === 0 ? <EmptyState title="Sem movimentações" /> : <TxList list={movimentacoes} />}
        </TabsContent>

        <TabsContent value="arquivos">
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="Arquivos virão em breve"
            description="Aqui você poderá anexar contratos, comprovantes, recibos e notas fiscais vinculados a este cliente."
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" | "primary" }) {
  const cls = tone === "success" ? "text-[color:var(--success)]" : tone === "destructive" ? "text-[color:var(--destructive)]" : tone === "primary" ? "text-primary" : "";
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-xl font-bold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}

function TxList({ list }: { list: any[] }) {
  return (
    <div className="space-y-2">
      {list.map((t) => (
        <div key={t.id} className="glass rounded-xl p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{t.description}</div>
            <div className="text-xs text-muted-foreground">{t.type.replace("_", " ")} · {formatDate(t.due_date || t.paid_at)}</div>
          </div>
          <span className={`font-display font-semibold ${["receita_propria", "comissao", "cashback", "repasse_recebido"].includes(t.type) ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]"}`}>
            {formatBRL(t.amount_gross)}
          </span>
          <StatusBadge status={t.status} />
        </div>
      ))}
    </div>
  );
}
