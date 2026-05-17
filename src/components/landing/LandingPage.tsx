import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Menu,
  LayoutDashboard,
  Users,
  Wallet,
  Repeat,
  ArrowDownUp,
  Package,
  Briefcase,
  Landmark,
  FileText,
  LineChart,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Shield,
  Sparkles,
  Target,
  Building2,
  Megaphone,
  Handshake,
  Eye,
  Layers,
  PieChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import logoHeader from "@/assets/logo-header.svg";

const NAV = [
  { href: "#inicio", label: "Início" },
  { href: "#problema", label: "Problema" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#recursos", label: "Recursos" },
  { href: "#para-quem", label: "Para quem é" },
  { href: "#acesso", label: "Acesso" },
  { href: "#faq", label: "FAQ" },
];

function RequestAccessDialog({
  trigger,
}: {
  trigger: React.ReactElement<{ asChild?: boolean }>;
}) {
  // Botão "Solicitar acesso" agora direciona para o fluxo de trial de 15 dias.
  return (
    <Link to="/trial" className="contents">
      {trigger}
    </Link>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center", className)} aria-label="Fyn Sinc">
      <img src={logoHeader} alt="Fyn Sinc" className="h-9 w-auto sm:h-10" />
    </Link>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Entrar</Link>
          </Button>
          <RequestAccessDialog
            trigger={
              <Button size="sm" className="shadow-[var(--shadow-glow)]">
                Solicitar acesso
              </Button>
            }
          />
        </div>
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85%] sm:w-[360px]">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <div className="mt-8 flex flex-col gap-1">
                {NAV.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-3 text-base text-foreground/90 transition-colors hover:bg-secondary"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <Button asChild variant="outline">
                  <Link to="/login">Entrar</Link>
                </Button>
                <RequestAccessDialog
                  trigger={<Button className="w-full">Solicitar acesso</Button>}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function Sparkline({ trend = "up" }: { trend?: "up" | "down" }) {
  const pts =
    trend === "up"
      ? "0,18 12,14 24,16 36,10 48,12 60,6 72,8 84,2"
      : "0,4 12,8 24,6 36,12 48,10 60,14 72,12 84,18";
  return (
    <svg viewBox="0 0 84 22" className="h-6 w-full">
      <defs>
        <linearGradient id={`g-${trend}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
      <polygon points={`${pts} 84,22 0,22`} fill={`url(#g-${trend})`} />
    </svg>
  );
}

function MockDashboard() {
  const stats = [
    { label: "Receita própria", value: "R$ 184.320", delta: "+12,4%", trend: "up" as const },
    { label: "Repasses de clientes", value: "R$ 96.510", delta: "+4,1%", trend: "up" as const },
    { label: "Lucro líquido", value: "R$ 87.810", delta: "+18,9%", trend: "up" as const },
    { label: "Recorrências ativas", value: "32", delta: "—", trend: "up" as const },
  ];
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-4 sm:p-5">
      <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        </div>
        <Badge variant="secondary" className="text-[10px]">Mês atual</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-display text-lg font-semibold sm:text-xl">{s.value}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-primary">{s.delta}</span>
              <div className="w-20"><Sparkline trend={s.trend} /></div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-border/60 bg-card p-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium">Clientes em acompanhamento</p>
          <span className="text-[11px] text-muted-foreground">8 ativos</span>
        </div>
        <div className="space-y-2">
          {[
            { n: "Studio Vértice", v: "R$ 24.110", c: "#14B8A6" },
            { n: "Nova Mídia", v: "R$ 18.430", c: "#3B82F6" },
            { n: "Loop Performance", v: "R$ 12.980", c: "#22C55E" },
          ].map((c) => (
            <div key={c.n} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: c.c }} />
                <span className="text-xs">{c.n}</span>
              </div>
              <span className="text-xs font-medium">{c.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-[oklch(0.55_0.18_220/0.25)] blur-3xl" />
      </div>
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
        <div>
          <Badge variant="secondary" className="mb-5 border-border/60">
            <Sparkles className="mr-1.5 h-3 w-3 text-primary" />
            Sistema financeiro operacional
          </Badge>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Controle financeiro real para empresas que{" "}
            <span className="bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">
              vendem serviços
            </span>
            .
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            O Fyn Sinc organiza receitas, repasses, aportes, comissões, taxas,
            cashback, documentos e recorrências em uma visão clara por cliente —
            para você saber exatamente quanto entra, quanto sai e quanto
            realmente sobra.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <RequestAccessDialog
              trigger={
                <Button size="lg" className="shadow-[var(--shadow-glow)]">
                  Solicitar acesso <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              }
            />
            <Button asChild size="lg" variant="outline">
              <a href="#como-funciona">Ver como funciona</a>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Dados isolados por organização</div>
            <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Visão por cliente</div>
            <div className="flex items-center gap-2"><PieChart className="h-4 w-4 text-primary" /> Lucro real</div>
          </div>
        </div>
        <div className="relative">
          <MockDashboard />
        </div>
      </div>
    </section>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("mx-auto max-w-3xl", align === "center" ? "text-center" : "text-left")}>
      {eyebrow && (
        <Badge variant="secondary" className="mb-4 border-border/60 text-primary">
          {eyebrow}
        </Badge>
      )}
      <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">{description}</p>
      )}
    </div>
  );
}

function ProblemSection() {
  const pains = [
    "Dinheiro do cliente misturado com receita da empresa",
    "Repasses sem controle claro",
    "Custos recorrentes esquecidos",
    "Comissões e taxas calculadas manualmente",
    "Dificuldade para saber o lucro por cliente",
    "Falta de histórico financeiro organizado",
  ];
  return (
    <section id="problema" className="border-t border-border/40 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="O problema"
          title="Sua empresa fatura, mas você sabe quanto realmente fica?"
          description="Muitas empresas de serviço misturam receita própria com dinheiro de cliente, ferramentas, taxas, repasses, cashback, comissões e custos recorrentes. No fim do mês, o faturamento parece bom, mas o lucro real fica confuso."
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pains.map((p) => (
            <Card
              key={p}
              className="group flex items-start gap-3 border-border/60 bg-card/60 p-5 transition-all hover:border-destructive/40 hover:bg-card"
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                <XCircle className="h-4 w-4" />
              </span>
              <p className="text-sm text-foreground/90">{p}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function TransformationSection() {
  const before = [
    "Planilhas soltas",
    "Controle manual",
    "Repasses confusos",
    "Falta de visão por cliente",
    "Lucro incerto",
    "Recorrências esquecidas",
  ];
  const after = [
    "Dashboard financeiro por cliente",
    "Controle de receita própria e repasses",
    "Aportes, taxas, comissões e cashback organizados",
    "Recorrências financeiras automatizadas",
    "Histórico completo de movimentações",
    "Clareza sobre lucro real",
  ];
  return (
    <section className="border-t border-border/40 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Transformação"
          title="Do financeiro confuso para uma operação sincronizada."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <Card className="border-border/60 bg-card/60 p-6 sm:p-8">
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="secondary" className="text-destructive">Antes</Badge>
              <span className="text-xs text-muted-foreground">Operação fragmentada</span>
            </div>
            <ul className="space-y-3">
              {before.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive/70" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="relative overflow-hidden border-primary/30 bg-card p-6 sm:p-8 shadow-[var(--shadow-glow)]">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
            <div className="mb-4 flex items-center gap-2">
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Depois com Fyn Sinc</Badge>
              <span className="text-xs text-muted-foreground">Operação sincronizada</span>
            </div>
            <ul className="space-y-3">
              {after.map((a) => (
                <li key={a} className="flex items-start gap-3 text-sm text-foreground/90">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      icon: Users,
      title: "Cadastre seus clientes",
      desc: "Organize cada cliente com seus contratos, valores, movimentações, documentos e recorrências.",
    },
    {
      icon: ArrowDownUp,
      title: "Separe o que é seu do que é do cliente",
      desc: "Controle receita própria, repasses, aportes, taxas, comissões e cashback sem misturar tudo.",
    },
    {
      icon: TrendingUp,
      title: "Acompanhe o lucro real",
      desc: "Veja quanto cada cliente movimenta, quanto gera de custo e quanto realmente sobra para a empresa.",
    },
    {
      icon: LayoutDashboard,
      title: "Monitore tudo pelo painel",
      desc: "Filtros por hoje, semana, mês, ano ou período personalizado para acompanhar a operação em tempo real.",
    },
  ];
  return (
    <section id="como-funciona" className="border-t border-border/40 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="Como funciona" title="Como o Fyn Sinc funciona" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Card key={s.title} className="relative border-border/60 bg-card/60 p-6 transition-all hover:border-primary/40">
              <span className="absolute right-5 top-5 font-display text-3xl font-semibold text-muted-foreground/30">
                0{i + 1}
              </span>
              <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <s.icon className="h-5 w-5" />
              </span>
              <h3 className="font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    { icon: LayoutDashboard, title: "Dashboard operacional", desc: "Visão geral com filtros por hoje, semana, mês, ano e período personalizado." },
    { icon: Users, title: "Clientes", desc: "Cadastro, detalhes, histórico financeiro, documentos e visão individual por cliente." },
    { icon: Wallet, title: "Financeiro", desc: "Controle de entradas, saídas, receitas próprias, repasses, taxas e movimentações." },
    { icon: Repeat, title: "Recorrências", desc: "Organização de pagamentos, cobranças, planos e custos recorrentes." },
    { icon: ArrowDownUp, title: "Aportes e Repasses", desc: "Separação do dinheiro que entra para operação e do que precisa ser repassado." },
    { icon: Package, title: "Planos e Ferramentas", desc: "Organize ferramentas, custos contratados, planos ativos e vínculos com clientes." },
    { icon: Briefcase, title: "Serviços", desc: "Cadastre serviços vendidos e acompanhe a rentabilidade da operação." },
    { icon: Landmark, title: "Bancos", desc: "Organize contas, bancos e formas de movimentação financeira." },
    { icon: FileText, title: "Documentos", desc: "Centralize arquivos importantes vinculados aos clientes." },
    { icon: LineChart, title: "Comparativo de períodos", desc: "Compare mês atual com anterior ou ano contra ano para entender evolução de lucro." },
  ];
  return (
    <section id="recursos" className="border-t border-border/40 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Recursos"
          title="Todos os módulos para operar com clareza"
          description="Cada parte do Fyn Sinc foi pensada para um pedaço real da operação financeira de empresas de serviço."
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {features.map((f) => (
            <Card
              key={f.title}
              className="group border-border/60 bg-card/60 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card"
            >
              <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="font-display text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  const bars = [
    { m: "Jan", a: 40, b: 55 },
    { m: "Fev", a: 52, b: 60 },
    { m: "Mar", a: 48, b: 70 },
    { m: "Abr", a: 60, b: 78 },
    { m: "Mai", a: 65, b: 82 },
    { m: "Jun", a: 70, b: 95 },
  ];
  return (
    <section className="border-t border-border/40 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Comparativo inteligente"
          title="Compare períodos e entenda se sua operação está evoluindo."
          description="Compare mês contra mês ou ano contra ano e visualize se um cliente está gerando mais lucro, mais custo ou mais movimentação no período atual."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-5">
          <div className="grid grid-cols-2 gap-3 lg:col-span-2">
            {[
              { l: "Mês atual", v: "R$ 184.320", d: "+18,9%", up: true },
              { l: "Mês anterior", v: "R$ 155.040", d: "ref.", up: true },
              { l: "Lucro líquido", v: "R$ 87.810", d: "+22,1%", up: true },
              { l: "Receita própria", v: "R$ 96.510", d: "+12,4%", up: true },
              { l: "Repasses", v: "R$ 41.230", d: "-3,8%", up: false },
              { l: "Custos", v: "R$ 28.940", d: "+1,2%", up: false },
            ].map((c) => (
              <Card key={c.l} className="border-border/60 bg-card/60 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.l}</p>
                <p className="mt-1 font-display text-lg font-semibold">{c.v}</p>
                <div className={cn("mt-1 flex items-center gap-1 text-xs", c.up ? "text-primary" : "text-destructive")}>
                  {c.up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {c.d}
                </div>
              </Card>
            ))}
          </div>
          <Card className="border-border/60 bg-card/60 p-5 sm:p-6 lg:col-span-3">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Evolução por mês</p>
                <p className="text-xs text-muted-foreground">Comparativo entre períodos</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/50" /> Anterior</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Atual</span>
              </div>
            </div>
            <div className="flex h-48 items-end gap-3 sm:gap-5">
              {bars.map((b) => (
                <div key={b.m} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full items-end justify-center gap-1.5">
                    <div
                      className="w-3 rounded-t-md bg-muted-foreground/40 sm:w-4"
                      style={{ height: `${b.a}%` }}
                    />
                    <div
                      className="w-3 rounded-t-md bg-[image:var(--gradient-primary)] sm:w-4"
                      style={{ height: `${b.b}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{b.m}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function AudienceSection() {
  const items = [
    { icon: Megaphone, t: "Agências de marketing" },
    { icon: Target, t: "Empresas de tráfego pago" },
    { icon: Briefcase, t: "Consultorias" },
    { icon: Repeat, t: "Prestadores de serviço recorrente" },
    { icon: Wallet, t: "Empresas que gerenciam verba de cliente" },
    { icon: Handshake, t: "Operações com comissões, repasses e taxas" },
    { icon: Building2, t: "Negócios que controlam lucro por cliente" },
  ];
  return (
    <section id="para-quem" className="border-t border-border/40 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Para quem é"
          title="Feito para empresas de serviço que precisam de controle financeiro operacional."
          description="Se sua empresa recebe valores, paga ferramentas, faz repasses, gerencia verba de cliente ou trabalha com contratos recorrentes, o Fyn Sinc foi pensado para sua rotina."
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((i) => (
            <Card key={i.t} className="flex items-center gap-3 border-border/60 bg-card/60 p-5 transition-all hover:border-primary/40">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <i.icon className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium">{i.t}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function DifferentialsSection() {
  const items = [
    { icon: Eye, t: "Visão por cliente", d: "Cada cliente com seu próprio extrato operacional." },
    { icon: ArrowDownUp, t: "Receita própria × terceiros", d: "Separação clara entre o que é seu e o que é do cliente." },
    { icon: Repeat, t: "Controle de repasses", d: "Saiba quanto, quando e para quem repassar." },
    { icon: Wallet, t: "Controle de aportes", d: "Entradas para operação organizadas e rastreáveis." },
    { icon: LineChart, t: "Comparativo de períodos", d: "Mês contra mês e ano contra ano sem planilha." },
    { icon: Briefcase, t: "Pensado para serviços", d: "Sem foco em estoque — foco em operação e contratos." },
    { icon: Sparkles, t: "Clareza financeira", d: "Bater o olho e entender o estado real da operação." },
    { icon: Layers, t: "Design objetivo", d: "Interface sem ruído, feita para uso diário." },
  ];
  return (
    <section className="border-t border-border/40 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Diferenciais"
          title="Por que o Fyn Sinc não é só mais um financeiro?"
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((i) => (
            <Card key={i.t} className="border-border/60 bg-card/60 p-5 transition-all hover:border-primary/40">
              <span className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <i.icon className="h-4 w-4" />
              </span>
              <h3 className="font-display text-base font-semibold">{i.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{i.d}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function AccessSection() {
  return (
    <section id="acesso" className="border-t border-border/40 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Acesso"
          title="Acesse o painel certo para sua operação."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <Card className="relative overflow-hidden border-primary/30 bg-card p-6 sm:p-8 shadow-[var(--shadow-glow)]">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
            <Badge className="mb-4 bg-primary/15 text-primary hover:bg-primary/15">Para empresas</Badge>
            <h3 className="font-display text-2xl font-semibold">Fyn Sinc App</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Área principal para empresas acompanharem seus clientes, financeiro,
              recorrências, repasses e resultados.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <a href="/login">Entrar no App <ArrowRight className="ml-1.5 h-4 w-4" /></a>
              </Button>
              <RequestAccessDialog
                trigger={<Button variant="outline">Solicitar acesso</Button>}
              />
            </div>
          </Card>
          <Card className="border-border/60 bg-card/60 p-6 sm:p-8">
            <Badge variant="secondary" className="mb-4">Reservado</Badge>
            <h3 className="font-display text-2xl font-semibold">Fyn Sinc Admin</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Área administrativa reservada ao super admin para gerenciar
              organizações, usuários, planos, acessos e configurações gerais do
              sistema.
            </p>
            <div className="mt-6">
              <Button asChild variant="outline">
                <a href="/login?next=/admin">
                  Acessar Admin <ArrowRight className="ml-1.5 h-4 w-4" />
                </a>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="border-t border-border/40 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Card className="relative overflow-hidden border-primary/30 bg-card p-8 sm:p-14 text-center shadow-[var(--shadow-elevated)]">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-[oklch(0.55_0.18_220/0.25)] blur-3xl" />
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Pare de olhar só para o faturamento.{" "}
            <span className="bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">
              Comece a enxergar o lucro real.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            O Fyn Sinc ajuda sua empresa de serviço a controlar clientes,
            repasses, custos, recorrências e resultados em uma única operação
            financeira sincronizada.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <RequestAccessDialog
              trigger={
                <Button size="lg" className="shadow-[var(--shadow-glow)]">
                  Solicitar acesso <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              }
            />
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Entrar no sistema</Link>
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40 py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:px-8">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm text-muted-foreground">
            Sistema financeiro operacional para empresas de serviço.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {[
            { t: "Início", h: "#inicio" },
            { t: "Recursos", h: "#recursos" },
            { t: "Para quem é", h: "#para-quem" },
            { t: "Acesso", h: "#acesso" },
          ].map((l) => (
            <a key={l.t} href={l.h} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {l.t}
            </a>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-7xl border-t border-border/40 px-4 pt-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
        © {new Date().getFullYear()} Fyn Sinc. Todos os direitos reservados.
      </div>
    </footer>
  );
}

const FAQ_ITEMS = [
  {
    q: "Como o Fyn Sinc trata repasses de clientes?",
    a: "Repasses entram como movimentação separada da receita própria. O sistema calcula automaticamente o que é seu e o que pertence ao cliente, sem inflar o seu faturamento.",
  },
  {
    q: "O que é \"lucro real\" no Fyn Sinc?",
    a: "É o resultado após descontar custos, comissões, taxas, cashback e repasses da receita própria. Você vê por cliente e no consolidado da operação.",
  },
  {
    q: "Repasse conta como minha receita?",
    a: "Não. Ele aparece como entrada e saída espelhadas e não soma ao lucro — evita a ilusão de faturamento alto com margem baixa.",
  },
  {
    q: "Como funciona o onboarding?",
    a: "Você cadastra clientes, planos, serviços, taxas e bancos, lança ou importa as primeiras movimentações e o painel já mostra receita, repasses e lucro real do mês.",
  },
  {
    q: "Quanto tempo leva para começar a usar?",
    a: "A operação básica fica de pé no mesmo dia. Histórico e recorrências são configurados conforme o volume de clientes.",
  },
  {
    q: "Preciso integrar com banco ou ERP?",
    a: "Não é obrigatório. O Fyn Sinc funciona de forma independente; integrações futuras são opcionais.",
  },
  {
    q: "Suporta comissões, cashback e taxas variáveis por cliente?",
    a: "Sim. Todos são parâmetros por cliente e plano e entram automaticamente no cálculo do lucro real.",
  },
];

function FAQSection() {
  return (
    <section id="faq" className="border-t border-border/60 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="FAQ"
          title="Perguntas frequentes"
          description="Respostas objetivas sobre repasses, lucro real e onboarding."
        />
        <Accordion type="single" collapsible className="mt-10 space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="rounded-xl border border-border/60 bg-card/40 px-4 last:border-b"
            >
              <AccordionTrigger className="text-left font-display text-base font-semibold hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <ProblemSection />
        <TransformationSection />
        <HowItWorksSection />
        <FeaturesSection />
        <ComparisonSection />
        <AudienceSection />
        <DifferentialsSection />
        <AccessSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
