## Diagnóstico

Verifiquei o Supabase externo:

- `expense_plans` já tem `installments_count` e `recurrence_mode` (default `finite`).
- `expense_occurrences` já tem `installment_number`, `installments_total`, `financial_transaction_id`, `paid_at`, `bank_id`, `status`.
- As funções `sync_expense_occurrence_on_tx` e `reset_occurrence_on_tx_delete` existem, **mas nenhum trigger está anexado em `financial_transactions`** (`information_schema.triggers` vazio). Por isso baixa/reversão no Financeiro não atualiza a ocorrência.
- Os 7 planos mais recentes (Mentoria, Cap Cut, Habilitação, etc.) estão com `recurrence_mode='finite'`, `installments_count=NULL` e apenas **1 ocorrência cada**. O form atual salvou `finite` sem total e não gerou as parcelas previstas. Com `total=null`, `computePlanProgress` retorna `total=—`, `remaining=null`, `progressPct=null` → exatamente o sintoma descrito.

Reaproveito a estrutura existente. Nenhum dado é inventado. Continua 100% no Supabase externo.

## 1. Migração SQL (idempotente)

```text
-- 1.1 Anexar triggers ausentes
CREATE TRIGGER trg_sync_expense_occurrence_on_tx
  AFTER INSERT OR UPDATE OF status, paid_at, bank_id ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_expense_occurrence_on_tx();

CREATE TRIGGER trg_reset_occurrence_on_tx_delete
  BEFORE DELETE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.reset_occurrence_on_tx_delete();

-- mesmo para provider_payables (sync_provider_payable_on_tx já existe sem trigger)
CREATE TRIGGER trg_sync_provider_payable_on_tx
  AFTER INSERT OR UPDATE OF status, paid_at, bank_id ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_provider_payable_on_tx();

-- 1.2 Índice único parcial p/ evitar duplicidade
CREATE UNIQUE INDEX IF NOT EXISTS ux_expense_occ_plan_due
  ON public.expense_occurrences (expense_plan_id, due_date)
  WHERE status <> 'cancelada';

-- 1.3 Constraint coerente em expense_plans
ALTER TABLE public.expense_plans
  ADD CONSTRAINT chk_plan_recurrence
  CHECK (
    recurrence_mode IN ('finite','continuous')
    AND (recurrence_mode <> 'finite' OR frequency = 'unica' OR installments_count >= 1)
  );
```

## 2. Backfill seguro (idempotente, sem inventar pagamento)

```text
-- a) Planos finite sem installments_count e sem como deduzir → vira continuous
UPDATE expense_plans
   SET recurrence_mode = 'continuous'
 WHERE recurrence_mode = 'finite'
   AND frequency IS NOT NULL AND frequency <> 'unica'
   AND installments_count IS NULL;

-- b) Status das ocorrências a partir das transações existentes
UPDATE expense_occurrences eo
   SET status='paga', paid_at=COALESCE(eo.paid_at, ft.paid_at::timestamptz, now())
  FROM financial_transactions ft
 WHERE ft.id = eo.financial_transaction_id
   AND ft.status = 'pago' AND eo.status NOT IN ('paga','cancelada');

UPDATE expense_occurrences eo
   SET status='lancada', paid_at=NULL
  FROM financial_transactions ft
 WHERE ft.id = eo.financial_transaction_id
   AND ft.status = 'pendente' AND eo.status NOT IN ('lancada','paga','cancelada','pausada');

-- c) Numerar installment_number por plano (due_date asc)
WITH ord AS (
  SELECT id, row_number() OVER (PARTITION BY expense_plan_id ORDER BY due_date, created_at) rn
    FROM expense_occurrences WHERE installment_number IS NULL
)
UPDATE expense_occurrences eo SET installment_number = ord.rn FROM ord WHERE ord.id = eo.id;

-- d) Preencher installments_total quando conhecido
UPDATE expense_occurrences eo
   SET installments_total = ep.installments_count
  FROM expense_plans ep
 WHERE ep.id = eo.expense_plan_id
   AND ep.installments_count IS NOT NULL
   AND eo.installments_total IS DISTINCT FROM ep.installments_count;
```

Nenhuma transação financeira é criada. Nenhuma ocorrência duplicada.

## 3. View `v_expense_plan_payment_progress`

`SECURITY INVOKER` (RLS de `expense_plans/occurrences/financial_transactions` aplica naturalmente) com `GRANT SELECT TO authenticated`.

Colunas: `organization_id, expense_plan_id, expense_name, recurrence_mode, total_installments, launched_installments, paid_installments, open_installments, not_launched_installments, remaining_installments, overdue_installments, next_due_date, progress_percentage, planned_total_amount, launched_total_amount, paid_total_amount, remaining_total_amount`.

Regras:
- `total_installments = COALESCE(installments_count, count(occ não cancelada))` para finite; `NULL` para continuous.
- `launched = count(financial_transaction_id IS NOT NULL AND status<>'cancelada')`.
- `paid = count(status='paga' OR ft.status='pago')`.
- `open = launched - paid`.
- `not_launched = count(financial_transaction_id IS NULL AND status NOT IN ('cancelada','pausada'))`.
- `overdue = count(status NOT IN ('paga','cancelada','pausada') AND due_date < current_date)`.
- `next_due_date = min(due_date) WHERE status NOT IN ('paga','cancelada','pausada')`.
- `progress_percentage = paid/total*100` quando `recurrence_mode='finite' AND total>0`, senão `NULL`.
- Montantes somam `amount` de ocorrências (`planned`), das lançadas, das pagas; `remaining = planned - paid` quando total conhecido.

## 4. Correção do form e geração de parcelas

`src/routes/_app/despesas-planejamento.tsx` (PlanFormSheet):

- Quando `recurrence_mode='finite'` e `frequency<>'unica'`: campo `installments_count` **obrigatório** (Zod `min(1)`); botão Salvar desabilitado até preencher.
- Na mutação de criação, gerar **todas** as ocorrências previstas em batch (loop `addFrequency` × `installments_count`) com `installment_number` e `installments_total` preenchidos. Hoje só cria a primeira — esse é o motivo de `occ_count=1`.
- `recurrence_mode='continuous'`: comportamento atual de gerar próxima parcela permanece.
- `unica`: 1 ocorrência, `installments_count=1`, `installments_total=1`.

## 5. Hook + UI

`src/lib/expenses.ts`: novo `fetchExpensePlanProgress(orgId)` lendo `v_expense_plan_payment_progress`. Manter `computePlanProgress` apenas como fallback client-side para listas combinadas.

`despesas-planejamento.tsx`:
- React Query key `['expense-progress', orgId]` invalidada junto com `expense-plans`, `expense-occurrences`, `expense-summary`, `transactions`, `dashboard`, `banks` em todas as mutações de pagar/reverter/lançar/cancelar/editar.
- **Card** (faixa compacta):
  - Finita: `X de Y pagas · Restam Z · N lançadas em aberto · Próxima dd/mm/aaaa` + barra de progresso + `%`; `N vencidas` em destructive quando >0.
  - Única: badge único (Paga em… / Lançada / Não lançada / Vencida desde…).
  - Contínua: `X pagamentos realizados · Y em aberto · N vencidas · Próxima…` + badge "Contínua", sem `%`.
- **Modal** seção "Progresso dos pagamentos": Total previsto, Lançadas, Pagas, Em aberto, Ainda não lançadas, Restantes, Vencidas, Próxima, Progresso %, Valor previsto/lançado/pago/restante. Lista de ocorrências `Parcela n/total — status — vencimento/pago em` com ações já existentes (Lançar, Ver no Financeiro, Cancelar, Editar vencimento).

## 6. Métricas topo

Quatro `MetricCard` agregando a view: Pagas no período · Restantes · Vencidas · Próximos 30 dias (qtd + valor).

## 7. PWA / segurança / env

Já fora do escopo da correção atual:
- `public/sw.js`: confirmar que `/rest/v1`, `/auth/v1`, `/storage/v1`, `/functions/v1` do domínio Supabase não são cacheados. Ajustar se necessário (verifico no build).
- `.gitignore`: garantir `.env`, `.env.*`, `!.env.example`, `*.local`. Criar `.env.example` com placeholders se não existir. Sem `service_role_key` no client (já garantido).
- RLS já ativa em todas as tabelas envolvidas; nada a alterar.

## Fora de escopo

Calendário financeiro, regras de bancos, cashback/taxas, dashboards adicionais, criação automática de transações no backfill.

## Critérios de aceite

- Card e modal exibem total, lançadas, pagas, em aberto, não lançadas, restantes, vencidas, próxima e %.
- Baixa/reversão no Financeiro reflete instantaneamente (trigger + invalidação).
- Planos antigos passam a mostrar progresso corretamente após backfill.
- Nenhum pagamento ou transação fictícia criada; nenhuma duplicidade.
- Tudo no Supabase externo; sem Lovable Cloud.
