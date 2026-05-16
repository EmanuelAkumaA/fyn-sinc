
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS financial_status text NOT NULL DEFAULT 'em_dia';

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_client_status_check,
  ADD CONSTRAINT clients_client_status_check CHECK (client_status IN ('ativo','inativo'));

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_financial_status_check,
  ADD CONSTRAINT clients_financial_status_check CHECK (financial_status IN ('em_dia','inadimplente'));

UPDATE public.clients
SET
  client_status = CASE
    WHEN status::text = 'inativo' THEN 'inativo'
    ELSE 'ativo'
  END,
  financial_status = CASE
    WHEN status::text = 'inadimplente' THEN 'inadimplente'
    ELSE 'em_dia'
  END;

CREATE INDEX IF NOT EXISTS idx_clients_org_client_status
  ON public.clients (organization_id, client_status);

CREATE INDEX IF NOT EXISTS idx_clients_org_financial_status
  ON public.clients (organization_id, financial_status);
