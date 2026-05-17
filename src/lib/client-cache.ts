import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalida todos os caches que dependem do cliente.
 * Usado após mutações em financeiro, recorrências, aportes, planos, documentos, etc.
 */
export function invalidateClientCaches(qc: QueryClient, clientId?: string | null) {
  const keys: (string | (string | undefined)[])[] = [
    "clients",
    "dashboard",
    "transactions",
    "recorrencias",
    "plans",
    "wallet",
  ];
  keys.forEach((k) => qc.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] }));

  if (clientId) {
    qc.invalidateQueries({ queryKey: ["client", clientId] });
    qc.invalidateQueries({ queryKey: ["client-summary", clientId] });
    qc.invalidateQueries({ queryKey: ["client-transactions", clientId] });
    qc.invalidateQueries({ queryKey: ["client-documents", clientId] });
    qc.invalidateQueries({ queryKey: ["client-recurring", clientId] });
    qc.invalidateQueries({ queryKey: ["client-plans", clientId] });
    qc.invalidateQueries({ queryKey: ["client-timeline", clientId] });
  } else {
    // invalida prefixos para todos os clientes
    ["client", "client-summary", "client-transactions", "client-documents", "client-recurring", "client-plans", "client-timeline"].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] }),
    );
  }
}
