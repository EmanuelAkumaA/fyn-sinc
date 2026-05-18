
-- Onda 1: hardening de RLS, constraints e índices

-- 1. Endurecer is_org_member para exigir status='active'
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_users
    WHERE organization_id = _org_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$function$;

-- 2. CHECK constraints adicionais
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_brand_color_check;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_brand_color_check
  CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_amount_gross_check;
ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_amount_gross_check
  CHECK (amount_gross >= 0);

-- 3. trial_requests: permitir INSERT público (formulário de trial)
DROP POLICY IF EXISTS "anyone can request trial" ON public.trial_requests;
CREATE POLICY "anyone can request trial"
  ON public.trial_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 4. Índices adicionais
CREATE INDEX IF NOT EXISTS idx_ft_org_due_status
  ON public.financial_transactions(organization_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_ft_org_client
  ON public.financial_transactions(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_recurring_org_next_due
  ON public.recurring_contracts(organization_id, next_due_date);
CREATE INDEX IF NOT EXISTS idx_client_documents_org_client
  ON public.client_documents(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_clients_org_name
  ON public.clients(organization_id, name);
