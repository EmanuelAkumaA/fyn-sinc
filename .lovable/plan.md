## Objetivo

Após o login, a sessão dura no máximo **1 hora**. Passou disso → logout automático e volta para `/login`. Antes disso, só sai mesmo se o usuário clicar em **Sair**.

O checkbox "Lembrar conexão" deixa de mexer em sessão: ele só salva o e-mail para pré-preencher o login da próxima vez.

---

## 1. Helper de sessão — `src/lib/session.ts` (novo)

Centraliza o limite de 1h:

- `SESSION_TTL_MS = 60 * 60 * 1000`
- `STORAGE_KEY = "fynsinc:session_expires_at"`
- `startSessionTimer()` — grava `Date.now() + SESSION_TTL_MS` no `localStorage`.
- `getSessionExpiresAt()` — lê o valor (ou `null`).
- `isSessionExpired()` — `expires_at != null && Date.now() >= expires_at`.
- `clearSessionTimer()` — remove a chave.
- `signOutAndRedirect(router, opts?)` — chama `supabase.auth.signOut()`, `clearSessionTimer()`, e redireciona para `/login`. Mostra um toast opcional ("Sua sessão expirou. Faça login novamente.").

Tudo é client-side (checagem `typeof window !== "undefined"`) para não quebrar SSR.

## 2. Login — `src/routes/login.tsx`

- Remover o `options: { remember }` falso passado pro `signInWithPassword` (essa opção não existe no Supabase).
- Após `signInWithPassword` com sucesso: chamar `startSessionTimer()` antes do `navigate({ to: "/dashboard" })`.
- "Lembrar conexão" passa a controlar apenas o e-mail:
  - Marcado → `localStorage.setItem("fynsinc:remembered_email", email)`
  - Desmarcado → `localStorage.removeItem("fynsinc:remembered_email")`
- No mount do componente: se a chave existir, preencher `email` e deixar `remember` marcado.
- Texto do label atualizado para deixar claro: **"Lembrar meu e-mail"** (evita confusão com sessão).

## 3. Guard da área autenticada — `src/routes/_app.tsx`

- `beforeLoad`: se `isSessionExpired()` → `await supabase.auth.signOut()` + `clearSessionTimer()` + `throw redirect({ to: "/login" })`. Só depois checa `getSession()`.
- Componente `AppLayout` recebe um novo hook `useSessionTimeout()` (próximo item) que faz a expiração ao vivo enquanto o app está aberto.

## 4. Hook `useSessionTimeout` — `src/hooks/use-session-timeout.ts` (novo)

Roda dentro de `_app` (área autenticada). Comportamento:

- Lê `getSessionExpiresAt()`.
- Agenda um `setTimeout` para o tempo restante. Quando dispara → `signOutAndRedirect(router, { reason: "expired" })`.
- Listener `visibilitychange` / `focus`: ao voltar para a aba, reavalia. Se já passou → logout imediato (cobre o caso de a aba ter ficado dormindo).
- Cleanup: limpa o timeout e os listeners no unmount.

Isso garante que mesmo com o app aberto a sessão cai exatamente em 1h.

## 5. Logout manual — `src/components/app-sidebar.tsx`

Trocar o `supabase.auth.signOut()` solto pelo helper `signOutAndRedirect(router)` para também limpar o timer e ir pro `/login` de forma consistente.

## 6. Cuidados / fora de escopo

- **Não** mexer em `autoRefreshToken` do client Supabase — deixa o token sendo renovado normalmente; quem controla a expiração de 1h é nosso timer.
- **Não** mexer em RLS, server functions, ou na lógica financeira.
- O JWT do Supabase já expira em 1h por padrão, mas como ele renova sozinho, é o nosso `session_expires_at` que vira a fonte de verdade. Quando o usuário desloga, o helper limpa essa chave + chama `signOut()`.
- Aba "esquecida" aberta por 1h passa a cair sozinha (timer dispara), e abrir o app depois do prazo também cai (checagem em `beforeLoad` + `visibilitychange`).

---

## Arquivos

**Novos**
- `src/lib/session.ts`
- `src/hooks/use-session-timeout.ts`

**Editados**
- `src/routes/login.tsx`
- `src/routes/_app.tsx`
- `src/components/app-sidebar.tsx`
