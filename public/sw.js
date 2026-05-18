// Service worker mínimo para tornar o PWA instalável.
// Não faz cache — apenas passa todas as requisições para a rede,
// evitando servir conteúdo antigo.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // no-op: deixa o navegador tratar normalmente.
});
