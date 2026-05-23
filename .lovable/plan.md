## Objetivo

Remover o timeout de 1 hora da sessão. O usuário só será deslogado quando clicar em "Sair" manualmente (ou quando o token do Supabase for invalidado pelo próprio Supabase).

## Mudanças

1. **`src/routes/_app.tsx`**
   - Remover `useSessionTimeout()`.
   - Remover checagens de `isSessionExpired()` (no `beforeLoad` e dentro do `evaluate`) e as chamadas a `clearSessionTimer()`.

2. **`src/routes/admin.tsx`**
   - Remover `useSessionTimeout()` e a checagem `isSessionExpired()` no `useEffect`.

3. **`src/routes/login.tsx`**
   - Remover a chamada `startSessionTimer()` após o login.
   - Remover o texto "Por segurança, sua sessão expira automaticamente após 1 hora."

4. **`src/lib/session.ts`**
   - Manter apenas `signOutAndRedirect` (usado pelo botão "Sair" e por fluxos de erro).
   - Remover constantes `SESSION_TTL_MS`/`SESSION_WARNING_MS` e funções `startSessionTimer`, `getSessionExpiresAt`, `isSessionExpired`, `clearSessionTimer`, `renewSessionTimer`.
   - Limpar a chave `fynsinc:session_expires_at` do localStorage uma vez (idempotente) para não deixar lixo em quem já usava.

5. **`src/hooks/use-session-timeout.ts`**
   - Apagar o arquivo (não terá mais consumidores).

## Comportamento resultante

- Sessão do Supabase permanece ativa indefinidamente com auto-refresh do token.
- Sem aviso de "sessão expira em 5 minutos", sem logout automático por inatividade/tempo.
- "Lembrar-me" continua funcionando como hoje (controla apenas se a sessão sobrevive ao fechar/abrir nova aba).
- Logout só via botão "Sair".
