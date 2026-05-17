import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "fynsinc.install-dismissed-at";
const INSTALLED_KEY = "fynsinc.install-done";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && safari;
}

function recentlyDismissed(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    return Date.now() - Number(v) < COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function useInstallPwa() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isInIframe() || isStandalone()) {
      setInstalled(true);
      return;
    }
    if (localStorage.getItem(INSTALLED_KEY)) {
      setInstalled(true);
      return;
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      try { localStorage.setItem(INSTALLED_KEY, "1"); } catch { /* ignore */ }
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    if (isIOSSafari()) setIsIOS(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") {
          try { localStorage.setItem(INSTALLED_KEY, "1"); } catch { /* ignore */ }
          setInstalled(true);
        }
      } catch { /* ignore */ }
      setDeferred(null);
      return;
    }
    if (isIOS) setShowInstructions(true);
  };

  const canInstall = !installed && (deferred !== null || isIOS);

  return { canInstall, isIOS, promptInstall, showInstructions, setShowInstructions };
}

export function InstallPwaBanner() {
  const { canInstall, promptInstall, showInstructions, setShowInstructions } = useInstallPwa();
  const [dismissed, setDismissed] = useState(() => recentlyDismissed());

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setDismissed(true);
  };

  const handleInstall = async () => {
    await promptInstall();
  };

  if (!canInstall || dismissed) {
    return <InstallInstructionsDialog open={showInstructions} onOpenChange={setShowInstructions} />;
  }

  return (
    <>
      <div className="fixed left-3 right-3 bottom-20 md:left-auto md:right-4 md:bottom-4 md:max-w-sm z-50">
        <div className="glass rounded-2xl p-3 flex items-center gap-3 shadow-lg border border-border/60">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-sm leading-tight">Instale o Fyn Sinc</div>
            <div className="text-xs text-muted-foreground truncate">Acesso rápido na tela inicial.</div>
          </div>
          <Button
            size="sm"
            onClick={handleInstall}
            style={{ background: "var(--gradient-primary)", color: "var(--background)" }}
          >
            Instalar
          </Button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Agora não"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <InstallInstructionsDialog open={showInstructions} onOpenChange={setShowInstructions} />
    </>
  );
}

function InstallInstructionsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar à Tela de Início</DialogTitle>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="h-7 w-7 shrink-0 rounded-full bg-secondary flex items-center justify-center font-semibold">1</span>
            <span className="flex-1">
              Toque no botão <span className="inline-flex items-center gap-1 font-medium"><Share className="h-3.5 w-3.5" /> Compartilhar</span> na barra do Safari.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="h-7 w-7 shrink-0 rounded-full bg-secondary flex items-center justify-center font-semibold">2</span>
            <span className="flex-1">
              Role e escolha <span className="inline-flex items-center gap-1 font-medium"><Plus className="h-3.5 w-3.5" /> Adicionar à Tela de Início</span>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="h-7 w-7 shrink-0 rounded-full bg-secondary flex items-center justify-center font-semibold">3</span>
            <span className="flex-1">Toque em <strong>Adicionar</strong>. Pronto — o Fyn Sinc abre como app.</span>
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}

