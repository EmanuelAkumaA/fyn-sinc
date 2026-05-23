ALTER TABLE public.recurring_contracts
  ADD COLUMN IF NOT EXISTS installments_total integer,
  ADD COLUMN IF NOT EXISTS installments_generated integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anchor_day smallint;

UPDATE public.recurring_contracts
SET anchor_day = EXTRACT(DAY FROM start_date)::smallint
WHERE anchor_day IS NULL;

UPDATE public.recurring_contracts rc
SET installments_generated = sub.cnt
FROM (
  SELECT recurring_contract_id, COUNT(*)::int AS cnt
  FROM public.financial_transactions
  WHERE recurring_contract_id IS NOT NULL
  GROUP BY recurring_contract_id
) sub
WHERE rc.id = sub.recurring_contract_id;

ALTER TABLE public.recurring_contracts
  ADD CONSTRAINT recurring_contracts_anchor_day_check
  CHECK (anchor_day IS NULL OR (anchor_day BETWEEN 1 AND 31));

ALTER TABLE public.recurring_contracts
  ADD CONSTRAINT recurring_contracts_installments_total_check
  CHECK (installments_total IS NULL OR installments_total > 0);