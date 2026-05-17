import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Wallet, TrendingDown, TrendingUp, Clock, AlertCircle, Banknote,
  ArrowDownLeft, ArrowUpRight, Award, Percent, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/metric-card";
import { PageHeader, EmptyState } from "@/components/ui-helpers";
import { formatBRL } from "@/lib/fynsinc";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Fyn Sinc" }] }),
});

function DashboardPage() {
  const { data: tx = [] } = useQuery({
    queryKey: ["dashboard-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("id, type, status, amount_gross, paid_at, due_date, client_id, platform")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["dashboard-banks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_bank_balance").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: wallets = [] } = useQuery({
    queryKey: ["dashboard-wallets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_client_wallet").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["dashboard-clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name");
      if (error) throw error;
      return data;
    },
  });
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";

  const sumBy = (filter: (t: typeof tx[number]) => boolean) =>
    tx.filter(filter).reduce((s, t) => s + Number(t.amount_gross || 0), 0);

  const receitaPropria =
    sumBy((t) => t.type === "receita_propria" && t.status === "pago") +
    sumBy((t) => t.type === "comissao" && t.status === "pago") +
    sumBy((t) => t.type === "cashback" && t.status === "pago");
  const despesas =
    sumBy((t) => t.type === "despesa_propria" && t.status === "pago") +
    sumBy((t) => t.type === "taxa" && t.status === "pago");
  const lucro = receitaPropria - despesas;
  const aReceber = sumBy((t) => t.type === "receita_propria" && t.status === "pendente");
  const today = new Date().toISOString().slice(0, 10);
  const inadimplencia = sumBy(
    (t) => t.type === "receita_propria" && t.status === "pendente" && !!t.due_date && t.due_date < today
  );
  const saldoBancos = banks.reduce((s, b: any) => s + Number(b.current_balance || 0), 0);
  const repassesRecebidos = sumBy((t) => t.type === "repasse_recebido" && t.status === "pago");
  const saldoRepasse = wallets.reduce((s: number, w: any) => s + Number(w.available_balance || 0), 0);
  const usoRepasse = sumBy((t) => t.type === "uso_repasse" && t.status === "pago");
  const comissoes = sumBy((t) => t.type === "comissao" && t.status === "pago");
  const cashbacks = sumBy((t) => t.type === "cashback" && t.status === "pago");
  const taxas = sumBy((t) => t.type === "taxa" && t.status === "pago");

  // chart data — last 6 months
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { key: d.toISOString().slice(0, 7), label: d.toLocaleDateString("pt-BR", { month: "short" }) };
  });
  const chartData = months.map((m) => {
    const inMonth = (t: any) => t.paid_at?.startsWith(m.key);
    const rec = tx.filter((t) => inMonth(t) && ["receita_propria", "comissao", "cashback"].includes(t.type)).reduce((s, t) => s + Number(t.amount_gross), 0);
    const desp = tx.filter((t) => inMonth(t) && ["despesa_propria", "taxa"].includes(t.type)).reduce((s, t) => s + Number(t.amount_gross), 0);
    return { mes: m.label, Receita: rec, Despesa: desp, Lucro: rec - desp };
  });

  // top clients by revenue
  const byClient = new Map<string, number>();
  tx.filter((t) => t.status === "pago" && ["receita_propria", "comissao", "cashback"].includes(t.type) && t.client_id)
    .forEach((t) => byClient.set(t.client_id!, (byClient.get(t.client_id!) || 0) + Number(t.amount_gross)));
  const topClients = [...byClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const isEmpty = tx.length === 0 && banks.length === 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Visão geral do seu financeiro" />

      {isEmpty ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="Sem dados ainda"
          description="Cadastre clientes, bancos e lançamentos — ou carregue dados de demonstração em Configurações."
        />
      ) : (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-4">
            <MetricCard label="Receita própria" value={formatBRL(receitaPropria)} hint="no período" tone="success" icon={TrendingUp} />
            <MetricCard label="Despesas" value={formatBRL(despesas)} hint="incluindo taxas" tone="destructive" icon={TrendingDown} />
            <MetricCard label="Lucro líquido" value={formatBRL(lucro)} tone={lucro >= 0 ? "primary" : "destructive"} icon={Wallet} />
            <MetricCard label="A receber" value={formatBRL(aReceber)} icon={Clock} />
            <MetricCard label="Inadimplência" value={formatBRL(inadimplencia)} tone="destructive" icon={AlertCircle} />
            <MetricCard label="Saldo em bancos" value={formatBRL(saldoBancos)} icon={Banknote} />
          </section>

          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3 mt-6">Operacional</h2>
          <section className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6">
            <MetricCard label="Repasses recebidos" value={formatBRL(repassesRecebidos)} icon={ArrowDownLeft} />
            <MetricCard label="Saldo de repasse" value={formatBRL(saldoRepasse)} hint="disponível dos clientes" tone="primary" icon={Wallet} />
            <MetricCard label="Aportes utilizados" value={formatBRL(usoRepasse)} icon={ArrowUpRight} />
            <MetricCard label="Comissões" value={formatBRL(comissoes)} tone="success" icon={Award} />
            <MetricCard label="Cashbacks" value={formatBRL(cashbacks)} tone="success" icon={Percent} />
            <MetricCard label="Taxas pagas" value={formatBRL(taxas)} tone="destructive" icon={TrendingDown} />
          </section>

          <section className="grid lg:grid-cols-2 gap-4 mb-6">
            <div className="glass rounded-2xl p-5">
              <h3 className="font-display font-semibold mb-4">Receita x Despesa</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.05)" />
                    <XAxis dataKey="mes" stroke="oklch(0.72 0.018 250)" fontSize={11} />
                    <YAxis stroke="oklch(0.72 0.018 250)" fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "oklch(0.227 0.025 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} formatter={(v: number) => formatBRL(v)} />
                    <Bar dataKey="Receita" fill="oklch(0.72 0.18 145)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Despesa" fill="oklch(0.66 0.22 27)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass rounded-2xl p-5">
              <h3 className="font-display font-semibold mb-4">Lucro líquido por mês</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.05)" />
                    <XAxis dataKey="mes" stroke="oklch(0.72 0.018 250)" fontSize={11} />
                    <YAxis stroke="oklch(0.72 0.018 250)" fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "oklch(0.227 0.025 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} formatter={(v: number) => formatBRL(v)} />
                    <Line type="monotone" dataKey="Lucro" stroke="oklch(0.72 0.12 184)" strokeWidth={2.5} dot={{ fill: "oklch(0.72 0.12 184)", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="glass rounded-2xl p-5">
            <h3 className="font-display font-semibold mb-4">Top clientes por receita</h3>
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <ol className="space-y-3">
                {topClients.map(([id, total], i) => (
                  <li key={id} className="flex items-center gap-3">
                    <span className="h-7 w-7 rounded-lg bg-secondary/50 flex items-center justify-center text-xs font-display font-bold">{i + 1}</span>
                    <span className="font-medium flex-1 truncate">{clientName(id)}</span>
                    <span className="font-display font-semibold text-[color:var(--success)]">{formatBRL(total)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </>
  );
}
