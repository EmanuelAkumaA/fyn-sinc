import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  getSessionExpiresAt,
  signOutAndRedirect,
  renewSessionTimer,
  SESSION_WARNING_MS,
} from "@/lib/session";

export function useSessionTimeout() {
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let warningId: ReturnType<typeof setTimeout> | null = null;

    const clearAll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (warningId) clearTimeout(warningId);
      timeoutId = null;
      warningId = null;
    };

    const showWarning = () => {
      toast.warning("Sua sessão expira em 5 minutos", {
        description: "Renove agora para não ser desconectado.",
        duration: SESSION_WARNING_MS,
        action: {
          label: "Renovar",
          onClick: () => {
            renewSessionTimer();
            toast.success("Sessão renovada por mais 1 hora.");
            // Reagendar timers com o novo horário
            clearAll();
            scheduleTimers();
          },
        },
      });
    };

    const scheduleTimers = () => {
      const exp = getSessionExpiresAt();
      if (exp == null) return;
      const remaining = exp - Date.now();
      if (remaining <= 0) {
        signOutAndRedirect(navigate, { reason: "expired" });
        return;
      }

      // Timer de logout
      timeoutId = setTimeout(() => {
        signOutAndRedirect(navigate, { reason: "expired" });
      }, remaining);

      // Timer de aviso (se ainda houver mais de 5 minutos)
      if (remaining > SESSION_WARNING_MS) {
        warningId = setTimeout(() => {
          showWarning();
        }, remaining - SESSION_WARNING_MS);
      } else if (remaining > 0) {
        // Já estamos dentro dos últimos 5 minutos
        showWarning();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        clearAll();
        scheduleTimers();
      }
    };

    scheduleTimers();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      clearAll();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [navigate]);
}
