import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const LEGACY_STORAGE_KEY = "fynsinc:session_expires_at";

// Limpa lixo do antigo timer de expiração de 1h, idempotente.
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
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
  if (opts.reason === "expired") {
    toast.info("Sua sessão expirou. Faça login novamente.");
  }
  navigate({ to: "/login" });
}
