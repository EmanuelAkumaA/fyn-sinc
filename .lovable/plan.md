# Plano — Módulo Equipe & Prestadores

## Estado atual (já pronto)

A base já está aplicada no banco e nos helpers:

- Tabelas `providers`, `provider_assignments`, `provider_payables` com RLS por `organization_id`.
- Triggers `sync_provider_payable_on_tx` e `unlink_tx_on_provider_payable_delete` (baixa pelo Financeiro já espelha em `provider_payables`).
- Views `v_provider_summary`, `v_client_profitability_summary`, `v_service_profitability_summary`.
- Helpers em `src/lib/providers.ts` (schemas Zod, `computeProviderCost`, `assignmentMonthlyCost`, `nextPayableDate`, `launchPayableInFinance` idempotente).
- Rota `/_app/equipe-prestadores` registrada (stub) e item no `app-sidebar`.

Portanto este plano é só de UI + glue. Nenhuma nova migration é necessária; se aparecer um gap pontual (ex.: unique constraint anti-duplicidade), aplico migration mínima.

## Escopo da implementação

### 1. Página `/_app/equipe-prestadores`
Substituir o stub por página completa com:
- `PageHeader` "Equipe & Prestadores" / "Controle de profissionais, custos de execução e pagamentos".
- 6 `MetricCard`s no topo: ativos, custo recorrente mensal, previstos no mês, pendentes, pagos no mês, em atraso — alimentados por `v_provider_summary` + agregação client-side de `provider_payables` do mês.
- Filtros por tipo / status / "com pendências" + busca (nome, documento, telefone, e-mail).
- Lista de cards de prestador (responsiva: grid desktop, 2 col tablet, 1 col mobile) com nome, tipo, status, custo recorrente, pendente no mês, total pago, contagem de clientes/serviços vinculados, botão editar, clique abre dossiê.
- Botão "Novo prestador" abre `Sheet` com `ProviderForm` (validado por `providerSchema`).

### 2. Componente `ProviderDossier` (`src/components/provider-dossier.tsx`)
`Sheet` grande no desktop, fullscreen no mobile, com header (dados + editar) e 4 cards (total pago, a pagar, atraso, custo recorrente). Tabs:
1. **Visão geral** — próximos pagamentos, últimas movimentações, clientes/serviços vinculados, alertas.
2. **Vínculos** — lista de `provider_assignments` com preview de receita prevista, custo, lucro Kuma e margem (usa `computeProviderCost`); ações: editar, pausar, encerrar, gerar próxima obrigação, abrir cliente/serviço. Botão "Novo vínculo" abre `AssignmentForm` (validado por `assignmentSchema`) com selects de cliente, serviço e `recurring_contract`, preview de cálculo, valor fixo OU porcentagem.
3. **Pagamentos** — lista de `provider_payables` com filtros (período, status, cliente, serviço). Ações: "Lançar no Financeiro" (chama `launchPayableInFinance` — idempotente), "Ver no Financeiro" (deep-link para `/financeiro` com filtro), "Cancelar", "Gerar próxima obrigação".
4. **Timeline** — agregação client-side em ordem reversa (criação do prestador, vínculos, obrigações geradas, lançamentos enviados, pagamentos realizados via `paid_at`, pausas/encerramentos).
5. **Observações** — textarea editável que persiste em `providers.notes`.

### 3. Geração de obrigações (V1, manual)
Em `src/lib/providers.ts` adicionar:
- `generateNextPayable(assignment)` — calcula próximo `due_date` via `nextPayableDate`, define `reference_month` via `monthAnchor`, faz `insert` com guarda anti-duplicidade (`select` antes por `provider_assignment_id + reference_month`).
- `generateMonthPayables(orgId, monthAnchor)` — varre vínculos recorrentes ativos e gera obrigações do mês ignorando as já existentes.

Botões "Gerar próxima obrigação" (no vínculo) e "Gerar obrigações do mês" (no header da aba Pagamentos do dossiê) consomem essas funções. Para vínculos `pontual`, ao criar o vínculo já gerar a obrigação única.

### 4. Lançar no Financeiro (sem duplicar)
O helper `launchPayableInFinance` já é idempotente (sai cedo se houver `financial_transaction_id`). UI:
- Botão "Lançar no Financeiro" quando `status = nao_lancada`.
- Substituído por "Ver no Financeiro" quando `financial_transaction_id` existir.
- `onSuccess`: `invalidateFinanceCaches(qc)` + invalidar `["provider-payables"]`, `["provider-summary"]`, `["expense-planning"]`, `["client-summary"]`, `["service-summary"]`, `["dashboard"]`.

### 5. Baixa pelo Financeiro (já funcional)
A trigger `sync_provider_payable_on_tx` já espelha `pago/pendente` em `provider_payables`. Sem mudança de backend. Apenas garantir que `PayTransactionDialog` invalide as queries de prestadores quando a transação tiver `provider_payable_id` — adicionar chaves ao `invalidateFinanceCaches` (`provider-payables`, `provider-summary`, `provider`, `providers`).

### 6. Integrações em outras telas (mudanças mínimas)
- **`despesas-planejamento`**: adicionar seção "Obrigações de prestadores" que lista `provider_payables` do mês (com origem "Prestador", link para abrir prestador / ver no Financeiro). Sem duplicar com `expense_occurrences`.
- **`client-dossier`**: bloco compacto "Custos de execução" lendo `v_client_profitability_summary` (custos previstos/realizados, lucro previsto/realizado, margem prevista/realizada, prestadores vinculados — `count distinct provider_id` em `provider_assignments` do cliente).
- **`service-dossier`**: métricas compactas equivalentes lendo `v_service_profitability_summary` + lista compacta de prestadores vinculados.
- **`dashboard`**: bloco compacto "Equipe & execução" (4 métricas: custos do mês, pendentes a prestadores, atrasados, margem média realizada) com botão "Ver equipe e prestadores" navegando para `/equipe-prestadores`. Inserido abaixo do bloco de composição de bancos. Não altera o Calendário Financeiro.

### 7. Estados vazios e responsividade
Aplicar `EmptyState` nos três níveis (sem prestador, sem vínculo, sem pagamento). Cards em grid `md:grid-cols-2 lg:grid-cols-3`, tabs com scroll horizontal no mobile, `Sheet` fullscreen `sm:max-w-2xl` no desktop.

## Detalhes técnicos

- **Stack**: TanStack Router + React Query + `supabase` browser client. Sem `createServerFn` (segue padrão do projeto, todo acesso é client-side com RLS).
- **Validação**: Zod (schemas já em `src/lib/providers.ts`); `react-hook-form` ou state local seguindo padrão de `planos.tsx`.
- **Idempotência**: `launchPayableInFinance` já garante; `generateNextPayable` deduplica por `(provider_assignment_id, reference_month)`. Se quiser garantia em DB, adicionar `CREATE UNIQUE INDEX provider_payables_assignment_month_uidx ON provider_payables (provider_assignment_id, reference_month) WHERE provider_assignment_id IS NOT NULL AND reference_month IS NOT NULL;` numa migration curta.
- **Tipos**: tabelas já estão em `src/integrations/supabase/types.ts` — usar normalmente. Cast `as any` apenas no helper já existente, novo código tipa direto.
- **Sem mudanças** em: Auth, RLS existente, Calendário Financeiro, fluxo de aportes/repasses, cashback, taxas, Admin, trial, SaaS.

## Entregas / arquivos

Criar:
- `src/components/provider-form.tsx`
- `src/components/assignment-form.tsx`
- `src/components/provider-dossier.tsx`
- (opcional) `supabase/migrations/<ts>_provider_payables_unique.sql` — só o índice anti-duplicidade.

Editar:
- `src/routes/_app/equipe-prestadores.tsx` — página principal.
- `src/lib/providers.ts` — adicionar `generateNextPayable`, `generateMonthPayables`, `cancelPayable`.
- `src/lib/finance.ts` — incluir chaves de prestador em `invalidateFinanceCaches`.
- `src/components/client-dossier.tsx` — bloco "Custos de execução".
- `src/components/service-dossier.tsx` — métricas + prestadores vinculados.
- `src/routes/_app/dashboard.tsx` — bloco compacto "Equipe & execução".
- `src/routes/_app/despesas-planejamento.tsx` — seção "Obrigações de prestadores".

Implementação será incremental nessa ordem: helpers → página + form de prestador → form de vínculo + dossiê → integrações em cliente/serviço/dashboard/despesas.
