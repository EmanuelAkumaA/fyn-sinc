## Objetivo
Dar respiro entre o botão "Sair" e a borda inferior do menu "Mais opções" no mobile.

## Mudança
**`src/components/app-sidebar.tsx` — `SheetContent` do `MobileBottomNav`**
- Aumentar o padding inferior do `SheetContent`, somando ao `env(safe-area-inset-bottom)` (ex.: `pb-[calc(env(safe-area-inset-bottom)+1.5rem)]`), para que "Sair" não fique colado na borda em qualquer dispositivo.

Sem outras alterações.