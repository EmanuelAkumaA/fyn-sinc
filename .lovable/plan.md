
## Objetivo

Mostrar um aviso para instalar o Fyn Sinc na tela inicial quando o usuário abrir o sistema pelo navegador (mobile principalmente), sem atrapalhar quem já instalou ou quem está no preview do Lovable.

## Componente novo: `src/components/install-pwa-banner.tsx`

Banner discreto fixo na parte inferior da tela (acima da `MobileBottomNav`), com ícone do app, texto curto ("Instale o Fyn Sinc na tela inicial") e dois botões: **Instalar** e **Agora não** (X).

### Lógica de exibição

Mostrar somente quando TODAS as condições baterem:
- Não está dentro de um iframe (`window.self === window.top`) — evita aparecer no preview do Lovable.
- Não está rodando em modo standalone (`matchMedia('(display-mode: standalone)').matches` ou `navigator.standalone` no iOS).
- Usuário não fechou o banner recentemente (flag `fynsinc.install-dismissed-at` no `localStorage`, com cooldown de 7 dias).
- Em Android/Chrome: o evento `beforeinstallprompt` foi capturado.
- Em iOS Safari: o user agent é iOS + Safari (sem `beforeinstallprompt`); aí o botão "Instalar" abre um pequeno modal com instruções "Toque em Compartilhar → Adicionar à Tela de Início".

### Comportamento

- Captura `beforeinstallprompt` no `useEffect` e guarda o evento em state; faz `preventDefault()` para poder disparar depois.
- Botão **Instalar** (Android): chama `deferredPrompt.prompt()` e aguarda `userChoice`. Se aceito, esconde o banner permanentemente (`installed=true` no localStorage). Se recusado, aplica cooldown.
- Botão **Instalar** (iOS): abre `Dialog` com instruções ilustradas.
- Botão **X / Agora não**: grava `dismissed-at = Date.now()` e esconde por 7 dias.
- Listener `appinstalled` → esconde o banner permanentemente.

## Integração

Montar o componente uma única vez dentro do `RootComponent` em `src/routes/__root.tsx`, logo após `<Outlet />` e antes do `<Toaster />`. Como o componente só renderiza quando faz sentido, é seguro deixá-lo global (aparece tanto em `/login` quanto dentro de `/_app`).

## Estilo

- `fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50`
- `glass rounded-2xl p-3` com cores do design system (sem hex hardcoded).
- No mobile, somar `bottom-20` quando estiver dentro de `_app` (para não cobrir a `MobileBottomNav`). Detectar via `window.location.pathname.startsWith('/_')` não é confiável — usar simplesmente `bottom-20 md:bottom-4` (a `MobileBottomNav` só existe em telas mobile e o offset extra não atrapalha em telas públicas).

## Fora de escopo

- Não adicionar service worker / cache offline.
- Não mexer no `manifest.webmanifest` (já está pronto).
- Não criar página dedicada de instalação.

## Arquivos afetados

- `src/components/install-pwa-banner.tsx` — novo.
- `src/routes/__root.tsx` — importar e renderizar o banner dentro do `RootComponent`.
