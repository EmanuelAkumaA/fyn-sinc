# Corrigir o roteamento "Acessar App" vs "Acessar Admin"

## O que está acontecendo hoje

```
"Entrar no App"   → <Link to="/login">                       → /login    → /dashboard
"Acessar Admin"   → <a   href="/login?next=/admin">          → /login?next=/admin → /admin (beforeLoad)
                                                                                  → super_admin? render
                                                                                  → senão: redirect /dashboard (silencioso)
```

Três falhas reais no fluxo:

1. **Botão `/admin` cai no app financeiro** quando o usuário logado **não é `super_admin`** — o `beforeLoad` do `/admin` redireciona para `/dashboard` sem aviso, então parece que o botão "Acessar Admin" leva ao app.
2. **Sessão já ativa**: se o usuário já está logado e clica em "Acessar Admin", ele cai em `/login`, vê o form, e ao logar de novo o `next` é respeitado. Mas se ele simplesmente recarregar o navegador estando logado, o `/login` não auto-redireciona; o ideal é honrar `next` automaticamente.
3. **Sessão expirada dentro do admin**: o `beforeLoad` do `/admin` faz `redirect({ to: "/login" })` **sem preservar `next=/admin`**, então depois de relogar o usuário cai em `/dashboard`.

## Plano

### 1. `/login` — auto-redirect quando já autenticado

No `useEffect` do `LoginPage`, ao montar:
- chamar `supabase.auth.getSession()`
- se existir sessão, ler `next` (já temos `readNextParam()`) e fazer `window.location.assign(next ?? "/dashboard")`

Assim, clicar em "Acessar Admin" estando logado vai direto pro destino, sem passar pelo form.

### 2. `/admin` — preservar `next` no redirect de login

Trocar:
```ts
if (!data.session) throw redirect({ to: "/login" });
```
por uma redirect que preserve `next=/admin`. Como já uso querystring crua (sem `validateSearch` no login para evitar romper outros `<Link to="/login">`), faço a navegação por URL completa:
```ts
if (!data.session) {
  window.location.assign("/login?next=/admin");
  throw redirect({ to: "/login" }); // fallback de tipo
}
```

### 3. `/admin` — avisar quando o usuário não é super_admin

Em vez de redirecionar silenciosamente para `/dashboard`, sinalizar via `sessionStorage` (`fynsinc:flash`) com mensagem "Acesso restrito ao super admin", e o `_app.tsx` lê esse flag uma vez e chama `toast.error` ao montar o dashboard. Isso elimina a confusão de "cliquei em Admin e fui pro App".

### 4. Landing — uniformizar os dois botões

- "Entrar no App" → `<a href="/login">` (sem `next`, default `/dashboard`)
- "Acessar Admin" → continua `<a href="/login?next=/admin">`

Manter `<a>` cru nos dois para evitar o problema de `Link` exigir `search` quando alguma rota declara `validateSearch`.

## Arquivos alterados

- `src/routes/login.tsx` — auto-redirect quando já há sessão, respeitando `next`.
- `src/routes/admin.tsx` — `beforeLoad` redireciona para `/login?next=/admin` (e sinaliza flash quando o usuário logado não é super_admin).
- `src/routes/_app/dashboard.tsx` — ler e consumir o flash em `sessionStorage` para mostrar toast.
- `src/components/landing/LandingPage.tsx` — sem mudança no fluxo (CTAs já corretos), só verificação final.

## Pergunta para o usuário

Antes de implementar a parte do toast, preciso confirmar uma coisa: o usuário que você está usando para testar "Acessar Admin" é o `kumatech4@gmail.com` (único `super_admin` cadastrado), ou é uma conta comum criada pelo trial? Se for conta comum, o comportamento atual de não entrar no `/admin` é **correto por segurança** — o que falta é só o aviso visível ("acesso restrito"). Se for o `kumatech4` e mesmo assim cai no dashboard, é um bug real de sessão/role que vou caçar com logs.
