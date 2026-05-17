## Objetivo

Adicionar um botão "Instalar app" acima do botão "Sair" na sidebar do painel (`/_app`), permitindo que o usuário dispare a instalação do PWA a qualquer momento — não só quando o banner aparecer.

## Mudanças

### 1. `src/components/install-pwa-banner.tsx`
Extrair a lógica de instalação para um hook reutilizável `useInstallPwa()` exportado do mesmo arquivo:
- Retorna `{ canInstall, isIOS, promptInstall }`.
- `canInstall = true` quando há `beforeinstallprompt` capturado OU é iOS Safari, e não está em iframe / standalone / já instalado.
- `promptInstall()` dispara `deferredPrompt.prompt()` no Android/Chrome ou abre o modal de instruções no iOS.
- Banner continua funcionando igual, só passa a consumir o hook internamente.

### 2. `src/components/app-sidebar.tsx`
No `AppSidebar` (desktop), logo acima do botão "Sair":
- Renderizar condicionalmente um botão "Instalar app" com ícone `Download` quando `canInstall === true`.
- Mesmo estilo do botão "Sair" (mesma classe), para consistência visual.
- `onClick` chama `promptInstall()`.
- Quando não dá pra instalar (já instalado / desktop sem suporte / dentro do iframe), o botão simplesmente não aparece.

Também adicionar o mesmo botão na `MobileBottomNav`? **Não** — a nav inferior já tem 5 itens fixos e o banner cobre o caso mobile. Mantemos só na sidebar desktop + na aba "Configurações" se o usuário quiser depois (fora de escopo agora).

## Fora de escopo

- Não mexer no `manifest.webmanifest`, service worker, ou no banner flutuante.
- Não adicionar o botão em outras telas além da sidebar.

## Arquivos afetados

- `src/components/install-pwa-banner.tsx` — extrair `useInstallPwa()` hook.
- `src/components/app-sidebar.tsx` — usar o hook e renderizar botão acima de "Sair".
