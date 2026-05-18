// Persistência da preferência "Lembrar-me".
// Estratégia: o token do Supabase fica sempre em localStorage (config do client),
// mas marcamos uma "tab" via sessionStorage. Se o usuário NÃO escolheu lembrar,
// no próximo carregamento de uma nova janela/aba (sem o marcador) deslogamos
// localmente antes de qualquer redirect, evitando o ciclo conecta/desconecta.

const REMEMBER_KEY = "fynsinc:remember";
const TAB_ALIVE_KEY = "fynsinc:tab_alive";
const REMEMBER_EMAIL_KEY = "fynsinc:remembered_email";

function hasWindow() {
  return typeof window !== "undefined";
}

export function setRememberPreference(remember: boolean, email?: string): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  window.sessionStorage.setItem(TAB_ALIVE_KEY, "1");
  if (remember && email) {
    window.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
  } else {
    window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
  }
}

export function getRememberedEmail(): string | null {
  if (!hasWindow()) return null;
  return window.localStorage.getItem(REMEMBER_EMAIL_KEY);
}

export function shouldRememberSession(): boolean {
  if (!hasWindow()) return true;
  // Default: lembrar (evita logout indesejado se a flag nunca foi setada).
  const v = window.localStorage.getItem(REMEMBER_KEY);
  return v === null ? true : v === "1";
}

export function markTabAlive(): void {
  if (!hasWindow()) return;
  window.sessionStorage.setItem(TAB_ALIVE_KEY, "1");
}

/**
 * Retorna true se a sessão atual NÃO deve sobreviver ao fechamento do navegador.
 * Detecta isso quando: o usuário desmarcou "Lembrar-me" e a aba atual não tem
 * o marcador de vida (ou seja, é uma janela/aba nova após reabrir o navegador).
 */
export function isStaleUnrememberedSession(): boolean {
  if (!hasWindow()) return false;
  if (shouldRememberSession()) return false;
  return window.sessionStorage.getItem(TAB_ALIVE_KEY) !== "1";
}

export function clearRememberState(): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(REMEMBER_KEY);
  window.sessionStorage.removeItem(TAB_ALIVE_KEY);
}
