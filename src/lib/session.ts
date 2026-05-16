import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hora
export const SESSION_WARNING_MS = 5 * 60 * 1000; // 5 minutos antes de expirar
const STORAGE_KEY = "fynsinc:session_expires_at";

function hasWindow() {
  return typeof window !== "undefined";
}

export function startSessionTimer(): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(STORAGE_KEY, String(Date.now() + SESSION_TTL_MS));
}

export function getSessionExpiresAt(): number | null {
  if (!hasWindow()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function isSessionExpired(): boolean {
  const exp = getSessionExpiresAt();
  return exp != null && Date.now() >= exp;
}

export function clearSessionTimer(): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

type SignOutOpts = { reason?: "expired" | "manual" };

export async function signOutAndRedirect(
  navigate: (opts: { to: string }) => void,
  opts: SignOutOpts = {},
): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore — vamos redirecionar de qualquer jeito
  }
  clearSessionTimer();
  if (opts.reason === "expired") {
    toast.info("Sua sessão expirou. Faça login novamente.");
  }
  navigate({ to: "/login" });
}

export function renewSessionTimer(): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(STORAGE_KEY, String(Date.now() + SESSION_TTL_MS));
}
