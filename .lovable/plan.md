# Despesas & Planejamento — acompanhamento dinâmico

Objetivo: cada despesa passa a exibir pagas / restantes / vencidas / próxima parcela / progresso, refletindo automaticamente as baixas feitas no Financeiro. Sem fluxo paralelo de pagamento, sem duplicar ocorrências nem transações.

## 1. Migração de schema (incremental e idempotente)

`expense_plans` — adicionar apenas o que falta:
- `installments_count integer null`
- `recurrence_mode text not null default 'finite'` com check `in ('finite','continuous')`
- Constraint: quando `recurrence_mode='finite'` e `frequency<>'unica'`, `installments_count >= 1`.

`expense_occurrences` — colunas `paid_at` e `status` já existem. Adicionar apenas:
- `installment_number integer null`
- `installments_total integer null`
- Índice único parcial `(expense_plan_id, due_date) where status <> 'cancelada'` para evitar duplicidade.

Triggers (a função `sync_expense_occurrence_on_tx` já existe mas não está anexada):
- `CREATE TRIGGER trg_sync_expense_occurrence_on_tx AFTER INSERT OR UPDATE ON financial_transactions FOR EACH ROW EXECUTE FUNCTION sync_expense_occurrence_on_tx();`
- Ajustar a função para também tratar reversão: se transação passa de `pago` para `pendente`, voltar ocorrência para `lancada` e limpar `paid_at`; se transação é deletada/desvinculada, voltar para `nao_lancada`/`lancada` conforme vínculo (a função `unlink_tx_on_occurrence_delete` já cuida do delete da ocorrência; complementar com trigger `BEFORE DELETE` na transação que reseta status da occurrence).

## 2. Backfill seguro (uma única migração de dados, idempotente)

Para cada `expense_occurrence`:
- Se houver `financial_transaction` vinculada com `status='pago'` → `status='paga'`, `paid_at = tx.paid_at`.
- Se houver transação vinculada não paga → `status='lancada'`.
- Sem transação e `due_date < hoje` e status atual `nao_lancada/lancada` → manter status mas considerar "vencida" via cálculo (não persistir como `vencida` automaticamente para preservar flexibilidade — a UI deriva).
- Numerar `installment_number` por `expense_plan_id` em ordem crescente de `due_date` via `row_number()`.
- `installments_total`: preencher só quando `expense_plans.installments_count` existir. Para despesas antigas sem total conhecido, deixar null e marcar plano como `recurrence_mode='continuous'`.

Nenhum pagamento fictício, nenhuma transação criada.

## 3. Camada de cálculo (`src/lib/expenses.ts`)

Nova função `computePlanProgress(plan, occurrences) → { total, paid, remaining, overdue, pending, nextDueDate, progressPct, isContinuous }`:
- `paid` = occurrences com `status='paga'` OU com tx vinculada `status='pago'`.
- `overdue` = `due_date < hoje` e status ∉ {paga, cancelada, pausada}.
- `pending` = status em {nao_lancada, lancada} e não pagas.
- `nextDueDate` = menor `due_date` ainda não paga (futura ou vencida), ignorando canceladas/pausadas.
- `total` = `installments_count` quando `recurrence_mode='finite'`; senão null.
- `progressPct` só quando total conhecido.

## 4. UI — `src/routes/_app/despesas-planejamento.tsx`

Cards de despesa: faixa compacta abaixo dos dados principais com:
- Finitas: `X de Y pagas` · `Restam Z` · `N vencidas` (se >0) · `Próxima: dd/mm/aaaa` · barra de progresso fina + `%`.
- Únicas: badge único (Pendente / Lançada / Pago em… / Vencida desde…).
- Contínuas: `X realizadas` · `Y pendentes` · `N vencidas` · `Próxima: …` · badge "Contínua", sem barra/percentual.

Cores via tokens semânticos existentes (success/destructive/primary/muted). Sem novas cores hardcoded.

Métricas topo (ajustar `MetricCard`s existentes, sem inflar):
- Pagamentos realizados no mês (qtd + valor).
- Parcelas restantes (qtd).
- Despesas vencidas (qtd + valor).
- Próximos vencimentos 30d (qtd + valor).

Detalhe da despesa (sheet/accordion existente): seção "Progresso dos pagamentos" com total / pagas / restantes / vencidas / % / próximo vencimento / valor previsto / pago / restante, seguida da lista de ocorrências (`Parcela n/total — status — vencimento/pago em`) e ações já existentes (lançar, ver no Financeiro, cancelar, editar vencimento se não paga).

Filtros: manter os atuais; adicionar `Com parcelas restantes`, `Quitadas`, `Contínuas`.

## 5. Formulário de despesa

Adicionar campos `recurrence_mode` (radio finite/continuous, default finite) e `installments_count` (number, exigido quando finite e frequência ≠ única; oculto quando continuous ou única). Geração inicial de ocorrências respeita o total.

## 6. Sincronização e invalidação

A baixa continua acontecendo só no Financeiro. O trigger garante `expense_occurrences.status` sincronizado. No client, invalidar após qualquer mutação relevante:
- `['expense-plans', orgId]`, `['expense-occurrences', orgId]`, `['expense-summary', orgId]`, `['transactions', orgId]`, `['dashboard', orgId]`, `['banks', orgId]`.
Reutilizar `invalidateFinanceCaches` adicionando as keys acima onde faltar.

## 7. Segurança

- Todas as queries com `organization_id = getCurrentOrgId()`.
- RLS já ativa em `expense_plans` / `expense_occurrences` — sem alteração.
- Sem Lovable Cloud; somente o Supabase externo já conectado.
- Sem service role no client.

## Fora de escopo

Calendário Financeiro, regras de bancos/cashback/taxas/aportes, criação automática de novas transações no backfill, dashboards visuais além das métricas indicadas.

## Resumo técnico

```
migration:
  expense_plans      += installments_count, recurrence_mode (+check)
  expense_occurrences+= installment_number, installments_total
                      + unique(expense_plan_id, due_date) where status<>'cancelada'
  trigger AFTER INS/UPD on financial_transactions -> sync_expense_occurrence_on_tx
  trigger BEFORE DEL  on financial_transactions -> reset occurrence status
  data backfill: status/paid_at/installment_number a partir das tx existentes

code:
  src/lib/expenses.ts            -> computePlanProgress + helpers
  src/routes/_app/despesas-planejamento.tsx
                                  -> card faixa progresso, métricas topo,
                                     filtros novos, detalhe com lista de parcelas
  form de despesa                -> recurrence_mode + installments_count
  invalidações React Query nas mutações existentes
```
