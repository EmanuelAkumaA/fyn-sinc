
# Plano — Fyn Sinc Admin + Hierarquia de Acessos + Trial de 15 dias

## Visão geral
Separar dois ambientes:
- **/admin** — Fyn Sinc Admin, exclusivo da Kuma Tech (super_admin)
- **/app** — Fyn Sinc App, usado por Kuma Tech e empresas clientes (isolado por organização)

Conectar o botão "Solicitar acesso" da landing a um fluxo de trial de 15 dias que cria usuário + organização + vínculo owner.

---

## 1. Banco de dados (migração Supabase)

### 1.1 Roles globais
Criar enum `global_role` (`super_admin`) e tabela `user_global_roles`:
- `id`, `user_id` (uuid, único), `role global_role`, `created_at`, `updated_at`
- RLS: SELECT apenas do próprio registro; INSERT/UPDATE/DELETE bloqueados (somente via service role / Admin)
- Função `is_super_admin(_user_id uuid)` SECURITY DEFINER

### 1.2 Organization members (substituir/normalizar `organization_users`)
Hoje existe `organization_users` com role `app_role`. Vamos:
- Adicionar enum `org_role` (`owner`, `manager`, `member`)
- Adicionar coluna `member_role org_role` em `organization_users` (default `owner` quando único) e coluna `status text` (`active`/`inactive`)
- Migrar dados existentes (registro atual de admin → `owner` ativo)
- Atualizar `is_org_member()` para considerar `status='active'`
- Função `has_org_role(_org uuid, _roles org_role[])`

### 1.3 Tabela `organizations` — novos campos
ALTER TABLE adicionando:
- `status text` (enum check: `trial|active|suspended|expired|canceled`) default `trial`
- `plan text` (`trial|starter|professional|enterprise`) default `trial`
- `trial_start_at timestamptz`
- `trial_ends_at timestamptz`
- `subscription_start_at timestamptz`
- `subscription_ends_at timestamptz`
- Organização Kuma Tech existente: setar `status='active'`, `plan='enterprise'`

### 1.4 Tabela `trial_requests` (opcional, para histórico)
Registrar solicitações de trial com: `email`, `responsible_name`, `whatsapp`, `company_name`, `segment`, `clients_estimate`, `organization_id`, `created_at`.

### 1.5 Trigger `handle_new_user` atualizada
Hoje cria org + organization_users automaticamente. Vamos ajustar para:
- Não criar org automaticamente se o signup vier do fluxo de trial (que cria explicitamente)
- Continuar criando para signup direto pelo /signup atual

### 1.6 Seed Kuma Tech
- Garantir organização "Kuma Tech" (status active, plan enterprise)
- Vincular `kumatech4@gmail.com` como `owner` da Kuma Tech
- Inserir em `user_global_roles` com `super_admin`
- Como o user_id depende do Auth, faremos via função idempotente que roda quando o user existir, ou orientação para criar conta primeiro

### 1.7 RLS
- `user_global_roles`: SELECT próprio
- `organizations`: SELECT/UPDATE membros + SELECT/UPDATE/INSERT/DELETE super_admin
- `organization_users`: SELECT próprios + super_admin lê todos
- Tabelas operacionais (clients, financial_transactions, recurring_contracts, services, banks, third_party_plans, client_documents): manter `is_org_member` + adicionar bypass `is_super_admin(auth.uid())`

---

## 2. Server functions (createServerFn)

Criar em `src/lib/`:
- `trial.functions.ts` — `requestTrial({name,email,whatsapp,company,segment,clientsEstimate,password})`: cria user via admin client, cria organização (status=trial, trial_ends_at=now+15d), vincula owner, registra trial_request. Retorna `{ok:true}` para front fazer signIn.
- `org.functions.ts` — `listMyOrganizations()`, `getOrgContext(orgId)`, `selectOrganization(orgId)` (valida acesso e status).
- `admin.functions.ts` (todas com middleware super_admin):
  - `listOrganizations(filters)`, `getOrganization(id)`, `activateOrg(id, plan)`, `suspendOrg(id)`, `cancelOrg(id)`, `extendTrial(id, newDate)`, `changePlan(id, plan)`, `listOrgUsers(id)`
  - `adminMetrics()` — counts para dashboard
  - `listUsersGlobal()`, `listTrials(filter)`
- Middleware `requireSuperAdmin` em `src/integrations/supabase/admin-middleware.ts` que estende `requireSupabaseAuth` e consulta `user_global_roles`.

---

## 3. Rotas (TanStack)

Estrutura nova:
```
src/routes/
  index.tsx                    (landing pública - já existe)
  login.tsx                    (já existe)
  trial.tsx                    (NOVO - formulário trial)
  select-org.tsx               (NOVO - seleção quando múltiplas orgs)
  _app.tsx                     (já existe - refatorar p/ checar org+status)
  _app/...                     (rotas existentes do app)
  _admin.tsx                   (NOVO - guard super_admin)
  _admin/
    index.tsx                  (dashboard /admin)
    organizations.tsx          (lista)
    organizations.$id.tsx      (detalhe)
    users.tsx
    trials.tsx
```

Guards:
- `_admin.tsx` — `beforeLoad` checa `super_admin`; senão redirect `/app`
- `_app.tsx` — checa sessão + organização ativa selecionada; trial expirado → tela bloqueio com CTA
- Após login: se 1 org → entra direto; se >1 → `/select-org`; super_admin sempre pode acessar `/admin`

Contexto de organização ativa: armazenar `currentOrgId` em localStorage + provider React; substituir `getCurrentOrgId()` em `src/lib/fynsinc.ts` para usar o selecionado (não mais "primeira org").

---

## 4. Páginas — Fyn Sinc Admin

Layout próprio em `src/components/admin/AdminSidebar.tsx` (replicando estilo do `AppSidebar` com tom admin).

### /admin (Dashboard)
Cards: total orgs, trials ativos, trials expirados, orgs ativas, suspensas, total usuários, novas solicitações 7d. + lista das últimas solicitações.

### /admin/organizations
Tabela com filtros por status/plan, colunas: nome, status badge, plano, owner, email, whatsapp, criada em, fim do trial, ações (ver, ativar, suspender, cancelar, estender).

### /admin/organizations/:id
Painel completo + tabs (dados, usuários, ações). Botões para todas as ações (ativar/suspender/cancelar/estender/alterar plano).

### /admin/users
Lista global de usuários com orgs vinculadas.

### /admin/trials
Filtros: todos, ativos, expirando ≤3 dias, expirados, convertidos.

---

## 5. Fluxo "Solicitar acesso" (trial)

### Landing (`LandingPage.tsx`)
- Botão "Solicitar acesso" → `navigate({to:'/trial'})`
- Botão "Entrar" → `/login`
- Header: Logo, Início, Recursos, Para quem é, Como funciona, Entrar, Solicitar acesso (sem menção a /admin)

### /trial
Formulário com validação Zod:
- responsible_name, email, whatsapp (mask), company_name, segment (select), clients_estimate (range), password, password_confirm

Submit → `requestTrial(...)` (server fn) → `supabase.auth.signInWithPassword` → `/app` (com a org criada já como única → entrada direta).

---

## 6. Tela de seleção de organização

`/select-org` lista cards por org com: nome, status badge, plano, dias restantes do trial. Orgs `suspended/canceled/expired` aparecem em estado bloqueado com mensagem.

---

## 7. Trial expirado

Em `_app.tsx`: se `currentOrg.status==='trial' && trial_ends_at < now` → renderizar `<TrialExpired />` (CTA "Entrar em contato") em vez do Outlet. Login continua funcionando. Super_admin do Admin vê marcador "expirado".

---

## 8. Ajustes em arquivos existentes

- `src/components/landing/LandingPage.tsx` — links dos botões para `/trial` e `/login`
- `src/lib/fynsinc.ts` — `getCurrentOrgId()` usa org selecionada (localStorage `fynsinc:current_org`)
- `src/routes/_app.tsx` — adiciona checagem de org + status + trial
- `src/components/app-sidebar.tsx` — se super_admin, adicionar item "Fyn Sinc Admin" → `/admin`
- `src/hooks/use-current-org.ts` (novo) — hook para org ativa + role

---

## 9. Segurança

- Service role usado apenas em `admin.functions.ts` e `trial.functions.ts`
- Todas server fns admin com `requireSuperAdmin`
- RLS em todas as tabelas operacionais continua via `is_org_member` (já existe) + adicionar `OR is_super_admin(auth.uid())` para o painel admin
- Validação Zod (min/max) em todos os inputs de trial

---

## 10. Ordem de execução

1. Migração SQL (roles globais, organization_users, organizations campos, RLS, seed Kuma Tech)
2. Server functions (trial, admin, org context) + middleware super_admin
3. Hook `useCurrentOrg` + ajuste `_app.tsx` + tela select-org + trial expirado
4. Página `/trial` + ligação dos botões da landing
5. Layout `_admin` + sidebar admin + dashboard
6. Páginas `/admin/organizations`, `/admin/organizations/:id`, `/admin/users`, `/admin/trials`
7. Verificação: login Kuma → vê item Admin; login cliente trial → entra no app; super_admin acessa /admin; cliente é bloqueado em /admin

---

## Pontos a confirmar antes de implementar

1. **Seed do super_admin**: o usuário `kumatech4@gmail.com` já existe no Supabase Auth? Se sim, posso vinculá-lo direto na migração; se não, devo criar via service role com uma senha temporária (qual?) ou aguardar você criar manualmente?
2. **Tela trial expirado**: usar texto "Entrar em contato para ativar acesso" com link para WhatsApp/email da Kuma Tech? Qual contato?
3. **Refatorar `organization_users` ou criar `organization_members` nova**: prefiro manter `organization_users` adicionando colunas (`member_role`, `status`) para não quebrar código existente. OK?
4. **Página /trial vs modal**: posso fazer página dedicada `/trial` (mais simples e melhor para SEO/compartilhamento). OK ou prefere modal?
