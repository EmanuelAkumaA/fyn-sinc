const KEY = "fynsinc:current_org";

export function getCurrentOrgIdLocal(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setCurrentOrgId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, id);
}

export function clearCurrentOrgId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
