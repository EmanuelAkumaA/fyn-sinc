# Bloqueio backend de orgs vencidas + acesso direto ao Admin

## Contexto

Hoje as ações financeiras (clients, banks, services, recurring_contracts, third_party_plans, financial_transactions, client_documents) acontecem direto do navegador via `supabase-js` com RLS. A guarda de trial vencido vive só no frontend (`_app.tsx` → `/trial-expired`), o que o usuário consegue burlar limpando localStorage ou batendo na API. Precisamos da validação **no backend** — e em Supabase isso significa **RLS no banco**, que é o único ponto que o cliente não contorna.

Também precisa ligar o botão "Acessar Admin" da landing ao fluxo de login do admin.

## 1. Backend: bloqueio por status da organização

### 1a. Função `is_org_active(_org_id uuid)`

`SECURITY DEFINER`, `STABLE`, retorna `true` quando a org pode operar:

- `status = 'active'` → true
- `status IN ('suspended','canceled','expired')` → false
- `status = 'trial'` → true se `trial_ends_at IS NULL OR trial_ends_at > now()`, caso contrário false
- super_admin (`is_super_admin(auth.uid())`) sempre true (bypass para Kuma Tech operar suporte)

### 1b. Endurecer RLS de escrita

Para cada tabela financeira/operacional listada acima, recriar as policies de **INSERT/UPDATE/DELETE** somando a checagem `is_org_active(organization_id)` ao `is_org_member(...)` atual. SELECT continua liberado (usuário precisa ver dados históricos na tela `/trial-expired` e em consulta).

Tabelas afetadas: `clients`, `banks`, `services`, `recurring_contracts`, `third_party_plans`, `financial_transactions`, `client_documents`.

A policy `super_admin all <table>` permanece inalterada.

### 1c. Server functions de trial/admin

`requestTrial` e funções admin já são server-side com middleware próprio — nenhuma mudança ali. O bloqueio no banco fecha a porta também para qualquer server function futura que faça insert/update mascarado como o usuário.

### Mensagem ao usuário

Quando o RLS bloqueia, o supabase-js devolve erro `new row violates row-level security policy`. O frontend continua redirecionando para `/trial-expired` antes disso, então o usuário comum só vê o erro se tentar burlar — comportamento desejado.

## 2. Landing: botão "Acessar Admin"

Em `src/components/landing/LandingPage.tsx` (linha 678) o link já aponta para `/admin`. O fluxo da rota `/admin` (`beforeLoad`) já:

1. Sem sessão → redireciona para `/login`
2. Com sessão mas sem `super_admin` → redireciona para `/dashboard`

Ou seja, o link funcional já existe. Para ficar explícito como pediu ("manda pra área de login do painel admin"), trocar o `href="/admin"` por um `<Link to="/login">` com um indicador de destino (`search: { next: "/admin" }`), e no `login.tsx` após autenticação respeitar `Route.useSearch().next` antes do fallback `/dashboard`. Assim quem clica em "Acessar Admin" cai no login e, após logar, vai direto pro `/admin` (que então faz a checagem de super_admin).

## Arquivos alterados

- **Migration nova** — função `is_org_active` + recriação das policies de write das 7 tabelas
- `src/components/landing/LandingPage.tsx` — botão "Acessar Admin" vira `<Link to="/login" search={{ next: "/admin" }}>`
- `src/routes/login.tsx` — ler `next` do search, validar (`startsWith("/")`), e usar como destino após login
