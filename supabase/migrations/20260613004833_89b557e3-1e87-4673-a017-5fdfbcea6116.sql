
-- 1. Triggers (funções já existem)
DROP TRIGGER IF EXISTS trg_sync_expense_occurrence_on_tx ON public.financial_transactions;
CREATE TRIGGER trg_sync_expense_occurrence_on_tx
  AFTER INSERT OR UPDATE OF status, paid_at, bank_id ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_expense_occurrence_on_tx();

DROP TRIGGER IF EXISTS trg_sync_provider_payable_on_tx ON public.financial_transactions;
CREATE TRIGGER trg_sync_provider_payable_on_tx
  AFTER INSERT OR UPDATE OF status, paid_at, bank_id ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_provider_payable_on_tx();

DROP TRIGGER IF EXISTS trg_reset_occurrence_on_tx_delete ON public.financial_transactions;
CREATE TRIGGER trg_reset_occurrence_on_tx_delete
  BEFORE DELETE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.reset_occurrence_on_tx_delete();

-- 2. Índice único parcial (evita parcelas duplicadas)
CREATE UNIQUE INDEX IF NOT EXISTS ux_expense_occ_plan_due
  ON public.expense_occurrences (expense_plan_id, due_date)
  WHERE status <> 'cancelada';

-- 3. Backfill: planos "finite" sem installments_count viram "continuous"
UPDATE public.expense_plans
   SET recurrence_mode = 'continuous'
 WHERE recurrence_mode = 'finite'
   AND frequency IS NOT NULL
   AND frequency <> 'unica'
   AND installments_count IS NULL;

-- 4. Backfill de status das ocorrências a partir das transações
UPDATE public.expense_occurrences eo
   SET status = 'paga',
       paid_at = COALESCE(eo.paid_at, ft.paid_at::timestamptz, now()),
       updated_at = now()
  FROM public.financial_transactions ft
 WHERE ft.id = eo.financial_transaction_id
   AND ft.status = 'pago'
   AND eo.status NOT IN ('paga','cancelada');

UPDATE public.expense_occurrences eo
   SET status = 'lancada',
       paid_at = NULL,
       updated_at = now()
  FROM public.financial_transactions ft
 WHERE ft.id = eo.financial_transaction_id
   AND ft.status = 'pendente'
   AND eo.status NOT IN ('lancada','paga','cancelada','pausada');

-- 5. Backfill installment_number
WITH ord AS (
  SELECT id,
         row_number() OVER (PARTITION BY expense_plan_id ORDER BY due_date, created_at) AS rn
    FROM public.expense_occurrences
   WHERE installment_number IS NULL
)
UPDATE public.expense_occurrences eo
   SET installment_number = ord.rn
  FROM ord
 WHERE ord.id = eo.id;

-- 6. Backfill installments_total quando o plano tem installments_count
UPDATE public.expense_occurrences eo
   SET installments_total = ep.installments_count
  FROM public.expense_plans ep
 WHERE ep.id = eo.expense_plan_id
   AND ep.installments_count IS NOT NULL
   AND eo.installments_total IS DISTINCT FROM ep.installments_count;

-- 7. View de progresso (security invoker → RLS dos planos/ocorrências aplica)
DROP VIEW IF EXISTS public.v_expense_plan_payment_progress;
CREATE VIEW public.v_expense_plan_payment_progress
WITH (security_invoker = on) AS
WITH occ AS (
  SELECT
    eo.expense_plan_id,
    eo.organization_id,
    eo.id AS occ_id,
    eo.status,
    eo.due_date,
    eo.amount,
    eo.financial_transaction_id,
    ft.status AS tx_status
    FROM public.expense_occurrences eo
    LEFT JOIN public.financial_transactions ft ON ft.id = eo.financial_transaction_id
),
agg AS (
  SELECT
    expense_plan_id,
    organization_id,
    count(*) FILTER (WHERE status <> 'cancelada')                                                              AS occ_active,
    count(*) FILTER (WHERE status <> 'cancelada' AND financial_transaction_id IS NOT NULL)                     AS launched,
    count(*) FILTER (WHERE status = 'paga' OR (tx_status = 'pago' AND status <> 'cancelada'))                  AS paid,
    count(*) FILTER (WHERE status <> 'cancelada' AND financial_transaction_id IS NULL
                       AND status NOT IN ('pausada'))                                                          AS not_launched,
    count(*) FILTER (WHERE status NOT IN ('paga','cancelada','pausada') AND due_date < current_date)           AS overdue,
    min(due_date) FILTER (WHERE status NOT IN ('paga','cancelada','pausada'))                                  AS next_due_date,
    coalesce(sum(amount) FILTER (WHERE status <> 'cancelada'), 0)                                              AS planned_amount,
    coalesce(sum(amount) FILTER (WHERE status <> 'cancelada' AND financial_transaction_id IS NOT NULL), 0)     AS launched_amount,
    coalesce(sum(amount) FILTER (WHERE status = 'paga' OR (tx_status = 'pago' AND status <> 'cancelada')), 0)  AS paid_amount
  FROM occ
  GROUP BY expense_plan_id, organization_id
)
SELECT
  ep.organization_id,
  ep.id                                            AS expense_plan_id,
  ep.name                                          AS expense_name,
  ep.recurrence_mode,
  CASE
    WHEN ep.recurrence_mode = 'continuous' THEN NULL
    WHEN ep.installments_count IS NOT NULL THEN ep.installments_count
    ELSE coalesce(agg.occ_active, 0)
  END                                              AS total_installments,
  coalesce(agg.launched, 0)                        AS launched_installments,
  coalesce(agg.paid, 0)                            AS paid_installments,
  greatest(coalesce(agg.launched, 0) - coalesce(agg.paid, 0), 0) AS open_installments,
  coalesce(agg.not_launched, 0)                    AS not_launched_installments,
  CASE
    WHEN ep.recurrence_mode = 'continuous' THEN NULL
    WHEN ep.installments_count IS NOT NULL THEN greatest(ep.installments_count - coalesce(agg.paid, 0), 0)
    ELSE greatest(coalesce(agg.occ_active, 0) - coalesce(agg.paid, 0), 0)
  END                                              AS remaining_installments,
  coalesce(agg.overdue, 0)                         AS overdue_installments,
  agg.next_due_date                                AS next_due_date,
  CASE
    WHEN ep.recurrence_mode = 'continuous' THEN NULL
    WHEN ep.installments_count IS NOT NULL AND ep.installments_count > 0
      THEN round((coalesce(agg.paid, 0)::numeric / ep.installments_count) * 100, 2)
    ELSE NULL
  END                                              AS progress_percentage,
  CASE
    WHEN ep.installments_count IS NOT NULL THEN ep.installments_count * ep.amount
    ELSE coalesce(agg.planned_amount, 0)
  END                                              AS planned_total_amount,
  coalesce(agg.launched_amount, 0)                 AS launched_total_amount,
  coalesce(agg.paid_amount, 0)                     AS paid_total_amount,
  CASE
    WHEN ep.installments_count IS NOT NULL
      THEN greatest(ep.installments_count * ep.amount - coalesce(agg.paid_amount, 0), 0)
    ELSE NULL
  END                                              AS remaining_total_amount
FROM public.expense_plans ep
LEFT JOIN agg ON agg.expense_plan_id = ep.id;

GRANT SELECT ON public.v_expense_plan_payment_progress TO authenticated;
