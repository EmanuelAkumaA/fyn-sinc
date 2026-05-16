# Plano — Fyn Sinc v1

Sistema financeiro operacional para empresas de serviço. Foco do v1: provar o diferencial (separar receita própria de repasse/aporte/comissão) com UX dark premium e mobile-first.

## Escopo do v1

**Inclui**

- Auth (login/cadastro) + criação automática de organização
- Layout shell: sidebar desktop, bottom nav mobile, header com filtro de período
- PWA completo (manifest + service worker, com guard para preview do Lovable)
- Dashboard executivo com cards, gráficos e rankings
- Clientes (listagem + detalhe com abas)
- Financeiro (receitas, despesas, taxas, transferências)
- Bancos (saldo calculado)
- Recorrências/mensalidades
- Aportes/Repasses (entrada + uso, saldo por cliente)
- Planos/Ferramentas (comissão + cashback)
- Cashback (controle próprio)
- Seed de demonstração (botão "carregar dados de exemplo")

**Fica para depois**: Cartões de crédito, Freelancers, módulo dedicado de Serviços (no v1 serviço é só um campo texto no lançamento), Arquivos/Storage, Usuários e papéis, Configurações avançadas, multiempresa com troca, auditoria, relatórios.

## Identidade visual

Tokens em `src/styles.css` (oklch):

- `--background` #0D1B2A, `--surface` #111827, card branco 4%, borda branca 10%
- `--foreground` #F7F9FA, `--muted-foreground` #94A3B8
- `--primary` #14B8A6, `--success` #22C55E, `--destructive` #EF4444, `--neutral` #4B5563
- Gradiente `--gradient-primary` petróleo→esmeralda para CTAs/cards destacados
- Sombras suaves, radius cards 20px, botões 14px, glassmorphism leve

Tipografia: Sora (headings/números grandes) + Inter (UI/textos), Google Fonts.

## Arquitetura técnica

- TanStack Start + file-based routing
- Supabase: auth + Postgres + RLS
- Server logic via `createServerFn` (não Edge Functions)
- Browser client para reads sob RLS; `requireSupabaseAuth` em mutations sensíveis
- Tailwind v4 + shadcn/ui
- PWA via `vite-plugin-pwa` com `devOptions.enabled: false` e guard contra iframe/hosts de preview

## Estrutura de rotas

```
src/routes/
  __root.tsx               shell PWA, providers, listener onAuthStateChange
  index.tsx                redireciona para /dashboard ou /login
  login.tsx
  signup.tsx
  _app.tsx                 layout autenticado (sidebar + bottom nav + header)
  _app/dashboard.tsx
  _app/clientes.tsx
  _app/clientes.$id.tsx    detalhe com abas
  _app/financeiro.tsx
  _app/recorrencias.tsx
  _app/aportes.tsx
  _app/planos.tsx
  _app/bancos.tsx
  _app/configuracoes.tsx   (seed/reset)
```

## Banco de dados (Supabase) — v1

Todas com `organization_id`, `created_at`, `updated_at`, RLS via função `is_org_member(uuid)`.

- `organizations` — nome, slug
- `organization_users` — user_id, organization_id, role (admin no v1)
- `clients` — nome, tipo (PF/PJ), documento, email, telefone, status
- `banks` — nome, tipo, saldo_inicial, cor
- `recurring_contracts` — client_id, descricao, valor, frequencia, proximo_vencimento, status
- `financial_transactions` — tipo (`receita_propria | despesa_propria | repasse_recebido | uso_repasse | comissao | cashback | taxa | transferencia`), client_id?, bank_id?, valor_bruto, valor_liquido, descricao, categoria, due_date, paid_at, status, parent_transaction_id (taxa↔receita; uso↔repasse), platform, fornecedor, observacao
- `third_party_plans` — client_id, fornecedor, nome_plano, valor_recebido_cliente, valor_pago_fornecedor, perc_comissao, valor_comissao, cashback_previsto, cashback_recebido, status

Views auxiliares:

- `v_client_wallet` — saldo de repasse por cliente/plataforma
- `v_bank_balance` — saldo_inicial + entradas pagas − saídas pagas + transferências
- `v_dashboard_metrics` — receita própria, despesas, lucro, a receber, inadimplência

Trigger `handle_new_user`: cria organização + organization_users como admin no signup.

## Regras de cálculo (em SQL views + helpers TS)

- Receita própria = Σ(receita_propria pagas) + Σ(comissao recebidas) + Σ(cashback recebidos)
- Repasse NÃO entra em receita própria, mas aumenta saldo do banco
- Taxa = despesa, vinculada via `parent_transaction_id` à receita original
- Marcar receita como paga abre drawer: banco, data, teve_taxa? → cria transação `taxa` filha automaticamente

## Componentes reutilizáveis

`AppSidebar`, `MobileBottomNav`, `AppHeader`, `PeriodFilter`, `MetricCard`, `StatusBadge`, `DataTable`, `EmptyState`, `NewTransactionDrawer`, `ClientDetailTabs`, `BankCard`, `RevenueExpenseChart` (Recharts), `RankingCard`, `ConfirmDialog`, `MarkAsPaidDrawer`.

## PWA

- `vite-plugin-pwa` com `registerType: autoUpdate`
- Manifest: nome "Fyn Sinc", theme `#0D1B2A`, display standalone, ícones 192/512
- Service worker desabilitado em dev e em hosts de preview Lovable / dentro de iframe
- NetworkFirst para HTML
- Instalação real só no app publicado

## Seed de demonstração

Server fn `seedDemoData()` (chamada de Configurações): 5 clientes, 3 bancos, 1 recorrência, ~20 lançamentos cobrindo todos os tipos, 2 planos de terceiros, 1 cashback previsto. `resetDemoData()` limpa tudo da org.

## Etapas de implementação

1. Tokens + fontes + `src/styles.css` dark
2. Migração SQL: tabelas, RLS, `is_org_member`, trigger `handle_new_user`, views
3. Auth: login/signup, listener no `__root`, rota `_app` protegida
4. Shell: sidebar desktop, bottom nav mobile, header com PeriodFilter
5. PWA: vite-plugin-pwa + manifest + ícones + guard
6. Dashboard: cards, gráficos, rankings
7. Clientes: lista + detalhe com abas
8. Financeiro: tabela + NewTransactionDrawer + MarkAsPaidDrawer (taxa automática)
9. Bancos: cards com saldo calculado
10. Recorrências: CRUD + próxima ocorrência
11. Aportes: entrada + uso, saldo por cliente/plataforma
12. Planos/Ferramentas: CRUD com comissão e cashback
13. Cashback: lista + marcar como recebido
14. Configurações: seed/reset

## Observações importantes

- Pré-requisito Supabase: "Confirm email" precisa estar desabilitado em dev (vou avisar com link no momento certo), senão o signup não loga direto.
- PWA tem limitações no preview do Lovable; só funciona de verdade no app publicado.
- Cartões, Freelancers, Arquivos, Permissões e módulo de Serviços ficam para v2 — o schema já permite encaixar depois sem refactor grande.  
  
  
MELHORIA NO PLANO 

Gostei do plano geral e quero seguir com ele, mas antes de aprovar faça estes ajustes:

1. PWA:

Na V1, implemente apenas o manifest instalável:

- nome do app: Fyn Sinc;

- ícones;

- theme color #0D1B2A;

- display standalone;

- mobile-first;

- experiência parecida com app no celular.

Não implemente service worker/offline agora, porque o sistema ainda estará em desenvolvimento e não quero problemas de cache ou preview no Lovable. Deixe o PWA completo com service worker para uma etapa futura, depois que a versão estiver publicada e estável.

2. Serviços:

Não deixe serviço apenas como campo texto. Crie uma tabela simples services já na V1, com:

- id

- organization_id

- name

- category

- type: avulso | recorrente

- status

- created_at

- updated_at

Nos lançamentos financeiros e recorrências, permitir selecionar um serviço existente.

3. Repasses/Aportes:

Garanta que repasse_recebido:

- aumenta saldo do banco;

- aumenta saldo de repasse do cliente;

- não entra como receita própria.

Garanta que uso_repasse:

- reduz saldo do banco ou cartão;

- reduz saldo de repasse do cliente;

- não entra como despesa própria comum.

4. Planos/Ferramentas:

Ao criar um plano/ferramenta de terceiro, o sistema deve refletir corretamente no financeiro:

- valor recebido do cliente como repasse_recebido;

- valor pago ao fornecedor como uso_repasse;

- comissão como receita própria do tipo comissao;

- cashback como receita própria do tipo cashback quando recebido.

5. Cashback:

Evite duplicidade de cashback entre third_party_plans e financial_transactions. Defina uma fonte oficial para o valor financeiro. O dashboard deve somar cashback apenas uma vez.

6. Cliente:

Mesmo que Arquivos/Storage fique para V2, crie no detalhe do cliente uma aba “Arquivos” com estado vazio, já preparada visualmente para contratos, comprovantes e documentos.

7. Segurança:

Confirme que todas as tabelas terão RLS ativo e isolamento por organization_id desde a primeira versão.

Com esses ajustes, pode iniciar a implementação da V1.