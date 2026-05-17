import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requestTrial } from "@/lib/trial.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startSessionTimer } from "@/lib/session";
import logoUrl from "@/assets/logo-full.svg";

export const Route = createFileRoute("/trial")({
  component: TrialPage,
  head: () => ({
    meta: [
      { title: "Teste grátis 15 dias — Fyn Sinc" },
      {
        name: "description",
        content:
          "Solicite seu acesso ao Fyn Sinc com 15 dias de teste grátis. Sem cartão de crédito.",
      },
    ],
  }),
});

const SEGMENTS = [
  "Agência de marketing",
  "Tráfego pago",
  "Consultoria",
  "Tecnologia",
  "Contabilidade",
  "Jurídico",
  "Educação",
  "Outro",
];

const CLIENT_RANGES = ["1-10", "11-30", "31-100", "100+"];

const Schema = z
  .object({
    responsibleName: z.string().trim().min(2, "Informe seu nome"),
    email: z.string().trim().email("E-mail inválido"),
    whatsapp: z.string().trim().min(8, "Informe um WhatsApp válido"),
    companyName: z.string().trim().min(2, "Informe o nome da empresa"),
    segment: z.string().min(1, "Selecione o segmento"),
    clientsEstimate: z.string().min(1, "Selecione a faixa de clientes"),
    password: z.string().min(8, "Senha mínima de 8 caracteres"),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "As senhas não conferem",
  });

function TrialPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    responsibleName: "",
    email: "",
    whatsapp: "",
    companyName: "",
    segment: "",
    clientsEstimate: "",
    password: "",
    passwordConfirm: "",
  });
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos");
      return;
    }
    setLoading(true);
    try {
      await requestTrial({
        data: {
          responsibleName: parsed.data.responsibleName,
          email: parsed.data.email,
          whatsapp: parsed.data.whatsapp,
          companyName: parsed.data.companyName,
          segment: parsed.data.segment,
          clientsEstimate: parsed.data.clientsEstimate,
          password: parsed.data.password,
        },
      });
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) throw error;
      startSessionTimer();
      toast.success("Trial criado! Bem-vindo ao Fyn Sinc.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao criar trial";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8 flex flex-col items-center">
          <img src={logoUrl} alt="Fyn Sinc" className="h-40 object-contain -mb-10" />
          <p className="text-white/90 text-sm font-medium tracking-wide">
            15 dias grátis • Sem cartão de crédito
          </p>
        </div>

        <form onSubmit={onSubmit} className="glass rounded-2xl p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do responsável</Label>
              <Input id="name" value={form.responsibleName} onChange={(e) => set("responsibleName", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa">WhatsApp</Label>
              <Input id="wa" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(11) 99999-9999" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Nome da empresa</Label>
              <Input id="company" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Segmento</Label>
              <Select value={form.segment} onValueChange={(v) => set("segment", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Qtd. de clientes</Label>
              <Select value={form.clientsEstimate} onValueChange={(v) => set("clientsEstimate", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CLIENT_RANGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Senha</Label>
              <Input id="pw" type="password" minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw2">Confirmar senha</Label>
              <Input id="pw2" type="password" minLength={8} value={form.passwordConfirm} onChange={(e) => set("passwordConfirm", e.target.value)} required />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full h-11 text-base font-medium" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
            {loading ? "Criando sua conta..." : "Começar trial de 15 dias"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta? <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
