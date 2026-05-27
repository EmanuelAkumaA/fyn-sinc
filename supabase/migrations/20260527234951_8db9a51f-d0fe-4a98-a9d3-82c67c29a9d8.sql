ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS cashback_expected numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_received numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_received_at date,
  ADD COLUMN IF NOT EXISTS cashback_bank_id uuid,
  ADD COLUMN IF NOT EXISTS cashback_status text NOT NULL DEFAULT 'nenhum';