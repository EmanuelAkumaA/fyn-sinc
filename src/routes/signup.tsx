import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({ meta: [{ title: "Criar conta — Fyn Sinc" }] }),
});

function SignupPage() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { company_name: companyName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada com sucesso");
    navigate({ to: "/dashboard" });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4" style={{ background: "var(--gradient-primary)" }}>
            <span className="font-display text-2xl font-bold text-background">F</span>
          </div>
          <h1 className="font-display text-3xl font-bold">Crie sua conta</h1>
          <p className="text-muted-foreground text-sm mt-1">Comece a organizar o financeiro da sua empresa</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company">Nome da empresa</Label>
            <Input id="company" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Minha Agência" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 text-base font-medium" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
            {loading ? "Criando..." : "Criar conta"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
