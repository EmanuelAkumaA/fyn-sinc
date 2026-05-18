import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { startSessionTimer } from "@/lib/session";
import { getRememberedEmail, setRememberPreference, shouldRememberSession } from "@/lib/remember";
import logoUrl from "@/assets/logo-full.svg";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — Fyn Sinc" }] }),
});

function readNextParam(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const n = new URLSearchParams(window.location.search).get("next");
  if (!n || !n.startsWith("/") || n.startsWith("//")) return undefined;
  return n;
}

function LoginPage() {
  const navigate = useNavigate();
  const next = readNextParam();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = getRememberedEmail();
    if (saved) setEmail(saved);
    setRemember(shouldRememberSession());
    // Só auto-redireciona quando a página recebeu um destino explícito.
    // Em /login normal, deixar o formulário disponível evita loop com sessão antiga.
    if (!next) return;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) window.location.assign(next);
    }).catch(() => {
      // Sessões locais corrompidas/expiradas não devem impedir um novo login.
      supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    });

    return () => {
      active = false;
    };
  }, [next]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);

    if (typeof window !== "undefined") {
      setRememberPreference(remember, email);
    }
    startSessionTimer();
    toast.success("Bem-vindo de volta");
    if (next) {
      // Hard navigate para garantir que beforeLoad do destino (ex.: /admin)
      // rode com a sessão recém-criada já hidratada.
      window.location.assign(next);
      return;
    }
    navigate({ to: "/dashboard" });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <img src={logoUrl} alt="Fyn Sinc" className="h-48 object-contain -mb-14" />
          <p className="text-white/90 text-sm font-medium tracking-wide drop-shadow-sm">Clareza, controle e resultado</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
            <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground cursor-pointer">
              Lembrar-me neste dispositivo
            </Label>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            Por segurança, sua sessão expira automaticamente após 1 hora.
          </p>
          <Button type="submit" disabled={loading} className="w-full h-11 text-base font-medium" style={{ background: "var(--gradient-primary)", color: "var(--background)" }}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">Criar conta</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
