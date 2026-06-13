
-- 1) Add columns to expense_plans
ALTER TABLE public.expense_plans
  ADD COLUMN IF NOT EXISTS installments_count integer,
  ADD COLUMN IF NOT EXISTS recurrence_mode text NOT NULL DEFAULT 'finite';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_plans_recurrence_mode_chk') THEN
    ALTER TABLE public.expense_plans
      ADD CONSTRAINT expense_plans_recurrence_mode_chk CHECK (recurrence_mode IN ('finite','continuous'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_plans_installments_count_chk') THEN
    ALTER TABLE public.expense_plans
      ADD CONSTRAINT expense_plans_installments_count_chk CHECK (installments_count IS NULL OR installments_count >= 1);
  END IF;
END $$;

-- 2) Add columns to expense_occurrences
ALTER TABLE public.expense_occurrences
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS installments_total integer;

-- Unique partial index to prevent duplicate occurrences on same due date (excluding cancelled)
CREATE UNIQUE INDEX IF NOT EXISTS expense_occurrences_plan_due_uq
  ON public.expense_occurrences (expense_plan_id, due_date)
  WHERE status <> 'cancelada';

-- 3) Improve sync function: handles paid -> pendente reversal
CREATE OR REPLACE FUNCTION public.sync_expense_occurrence_on_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.expense_occurrence_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.bank_id IS NOT DISTINCT FROM NEW.bank_id
     AND OLD.paid_at IS NOT DISTINCT FROM NEW.paid_at THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'pago' THEN
    UPDATE public.expense_occurrences
       SET status = 'paga',
           paid_at = COALESCE(NEW.paid_at::timestamptz, now()),
           bank_id = COALESCE(NEW.bank_id, bank_id),
           updated_at = now()
     WHERE id = NEW.expense_occurrence_id;
  ELSIF NEW.status = 'pendente' THEN
    UPDATE public.expense_occurrences
       SET status = 'lancada',
           paid_at = NULL,
           updated_at = now()
     WHERE id = NEW.expense_occurrence_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Attach triggers on financial_transactions
DROP TRIGGER IF EXISTS trg_sync_expense_occurrence_on_tx ON public.financial_transactions;
CREATE TRIGGER trg_sync_expense_occurrence_on_tx
  AFTER INSERT OR UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_expense_occurrence_on_tx();

DROP TRIGGER IF EXISTS trg_sync_provider_payable_on_tx ON public.financial_transactions;
CREATE TRIGGER trg_sync_provider_payable_on_tx
  AFTER INSERT OR UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_provider_payable_on_tx();

-- 5) On tx delete, reset occurrence/payable status (vínculo será limpado por unlink_tx_on_occurrence_delete? Não — esse é para occurrence delete).
CREATE OR REPLACE FUNCTION public.reset_occurrence_on_tx_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.expense_occurrence_id IS NOT NULL THEN
    UPDATE public.expense_occurrences
       SET status = 'nao_lancada',
           paid_at = NULL,
           launched_at = NULL,
           financial_transaction_id = NULL,
           updated_at = now()
     WHERE id = OLD.expense_occurrence_id;
  END IF;
  IF OLD.provider_payable_id IS NOT NULL THEN
    UPDATE public.provider_payables
       SET status = 'nao_lancada',
           paid_at = NULL,
           launched_at = NULL,
           financial_transaction_id = NULL,
           updated_at = now()
     WHERE id = OLD.provider_payable_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_occurrence_on_tx_delete ON public.financial_transactions;
CREATE TRIGGER trg_reset_occurrence_on_tx_delete
  BEFORE DELETE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.reset_occurrence_on_tx_delete();

-- 6) Backfill: sync occurrence status from financial_transactions
UPDATE public.expense_occurrences eo
   SET status = 'paga',
       paid_at = COALESCE(eo.paid_at, ft.paid_at, now()),
       updated_at = now()
  FROM public.financial_transactions ft
 WHERE ft.id = eo.financial_transaction_id
   AND ft.status = 'pago'
   AND eo.status <> 'paga'
   AND eo.status <> 'cancelada';

UPDATE public.expense_occurrences eo
   SET status = 'lancada',
       updated_at = now()
  FROM public.financial_transactions ft
 WHERE ft.id = eo.financial_transaction_id
   AND ft.status = 'pendente'
   AND eo.status NOT IN ('lancada','paga','cancelada','pausada');

-- 7) Backfill installment_number / installments_total
WITH numbered AS (
  SELECT id, expense_plan_id,
         row_number() OVER (PARTITION BY expense_plan_id ORDER BY due_date, created_at) AS rn
    FROM public.expense_occurrences
   WHERE status <> 'cancelada'
)
UPDATE public.expense_occurrences eo
   SET installment_number = n.rn
  FROM numbered n
 WHERE eo.id = n.id
   AND eo.installment_number IS NULL;

-- For plans where installments_count is known, fill installments_total
UPDATE public.expense_occurrences eo
   SET installments_total = ep.installments_count
  FROM public.expense_plans ep
 WHERE ep.id = eo.expense_plan_id
   AND ep.installments_count IS NOT NULL
   AND eo.installments_total IS NULL;
