import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getSessionExpiresAt, signOutAndRedirect } from "@/lib/session";

export function useSessionTimeout() {
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const check = () => {
      const exp = getSessionExpiresAt();
      if (exp == null) return;
      const remaining = exp - Date.now();
      if (remaining <= 0) {
        signOutAndRedirect(navigate, { reason: "expired" });
        return;
      }
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        signOutAndRedirect(navigate, { reason: "expired" });
      }, remaining);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };

    check();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", check);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", check);
    };
  }, [navigate]);
}
