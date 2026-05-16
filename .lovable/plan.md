# Corrigir desconexão ao dar refresh

## Causa raiz

O `beforeLoad` da rota `/_app` (em `src/routes/_app.tsx`) roda tanto no servidor (SSR) quanto no cliente. No servidor:

- `isSessionExpired()` retorna `false` (não há `localStorage`).
- `supabase.auth.getSession()` retorna `null`, porque o cliente Supabase do navegador persiste a sessão em `localStorage` — que não existe no SSR.
- Resultado: o `beforeLoad` lança `redirect({ to: "/login" })` em **todo refresh**, mesmo com o usuário logado.

Esse é exatamente o sintoma relatado: ao dar F5 em qualquer página interna, o app cai no `/login`.

## Correção

Tornar a verificação de sessão **client-only**, mantendo a lógica de expiração de 1 hora e o logout manual já implementados.

### 1. `src/routes/_app.tsx`
- No `beforeLoad`, retornar cedo quando `typeof window === "undefined"` (SSR). Não redirecionar a partir do servidor.
- Manter a checagem de `isSessionExpired()` + `supabase.auth.getSession()` apenas no cliente — comportamento atual fica preservado para navegação client-side.
- Adicionar um pequeno guard no `AppLayout` (via `useEffect` + `useAuth`) que, após hidratar, redireciona para `/login` se realmente não houver sessão. Isso cobre o caso de o usuário abrir uma rota protegida sem login após a hidratação client.

### 2. `src/routes/index.tsx`
- Mesmo problema: `beforeLoad` chama `supabase.auth.getSession()` no SSR, que sempre retorna `null`, mandando todo mundo para `/login`. Aplicar o mesmo early-return no SSR e deixar a decisão para o cliente (ou usar `useEffect` no componente).

### 3. Sem mudanças em
- `src/lib/session.ts` (timer de 1h continua funcionando).
- `src/hooks/use-session-timeout.ts` (aviso de 5 min continua funcionando).
- `src/routes/login.tsx` (login continua chamando `startSessionTimer`).

## Fora de escopo
- Não trocar o storage de auth para cookies (manteria SSR, mas é mudança maior e o app é client-rendered de qualquer forma).
- Não alterar o fluxo de logout/expiração — eles continuam idênticos.

## Resultado esperado
- F5 em `/dashboard`, `/clientes`, etc. mantém o usuário logado.
- Sessão ainda expira automaticamente após 1 hora com aviso aos 5 min restantes.
- Logout manual e expiração continuam redirecionando para `/login`.
