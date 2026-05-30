
-- =====================================================
-- EQUIPE & PRESTADORES — V1
-- =====================================================

-- 1) providers
CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  provider_type text NOT NULL CHECK (provider_type IN ('funcionario','freelancer','prestador','empresa_terceirizada','consultor','especialista','outro')),
  document text NULL,
  email text NULL,
  phone text NULL,
  pix_key text NULL,
  payment_notes text NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_providers_org ON public.providers(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.providers TO authenticated;
GRANT ALL ON public.providers TO service_role;

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members select providers" ON public.providers
  FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "org members insert providers" ON public.providers
  FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update providers" ON public.providers
  FOR UPDATE TO authenticated USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete providers" ON public.providers
  FOR DELETE TO authenticated USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "super_admin all providers" ON public.providers
  FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER set_providers_updated_at BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) provider_assignments
CREATE TABLE public.provider_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  client_id uuid NULL,
  service_id uuid NULL,
  client_recurring_contract_id uuid NULL,
  assignment_type text NOT NULL CHECK (assignment_type IN ('pontual','recorrente')),
  compensation_type text NOT NULL CHECK (compensation_type IN ('valor_fixo','porcentagem')),
  fixed_amount numeric NULL CHECK (fixed_amount IS NULL OR fixed_amount >= 0),
  percentage numeric NULL CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100)),
  frequency text NULL CHECK (frequency IS NULL OR frequency IN ('unica','semanal','quinzenal','mensal','bimestral','trimestral','semestral','anual')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','encerrado','cancelado')),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compensation_value_required CHECK (
    (compensation_type = 'valor_fixo' AND fixed_amount IS NOT NULL) OR
    (compensation_type = 'porcentagem' AND percentage IS NOT NULL)
  )
);
CREATE INDEX idx_pa_org ON public.provider_assignments(organization_id);
CREATE INDEX idx_pa_provider ON public.provider_assignments(provider_id);
CREATE INDEX idx_pa_client ON public.provider_assignments(client_id);
CREATE INDEX idx_pa_service ON public.provider_assignments(service_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_assignments TO authenticated;
GRANT ALL ON public.provider_assignments TO service_role;

ALTER TABLE public.provider_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members select provider_assignments" ON public.provider_assignments
  FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "org members insert provider_assignments" ON public.provider_assignments
  FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update provider_assignments" ON public.provider_assignments
  FOR UPDATE TO authenticated USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete provider_assignments" ON public.provider_assignments
  FOR DELETE TO authenticated USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "super_admin all provider_assignments" ON public.provider_assignments
  FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER set_pa_updated_at BEFORE UPDATE ON public.provider_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Alter financial_transactions: add provider_payable_id
ALTER TABLE public.financial_transactions ADD COLUMN provider_payable_id uuid NULL;
CREATE INDEX idx_ft_provider_payable ON public.financial_transactions(provider_payable_id);

-- 4) provider_payables
CREATE TABLE public.provider_payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  provider_assignment_id uuid NULL,
  client_id uuid NULL,
  service_id uuid NULL,
  financial_transaction_id uuid NULL,
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  due_date date NOT NULL,
  reference_month date NULL,
  status text NOT NULL DEFAULT 'nao_lancada' CHECK (status IN ('nao_lancada','lancada','paga','vencida','cancelada')),
  launched_at timestamptz NULL,
  paid_at timestamptz NULL,
  bank_id uuid NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pp_org ON public.provider_payables(organization_id);
CREATE INDEX idx_pp_provider ON public.provider_payables(provider_id);
CREATE INDEX idx_pp_assignment ON public.provider_payables(provider_assignment_id);
CREATE INDEX idx_pp_status ON public.provider_payables(status);
CREATE UNIQUE INDEX uq_pp_assignment_month ON public.provider_payables(provider_assignment_id, reference_month)
  WHERE provider_assignment_id IS NOT NULL AND reference_month IS NOT NULL;
CREATE UNIQUE INDEX uq_pp_ft ON public.provider_payables(financial_transaction_id)
  WHERE financial_transaction_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_payables TO authenticated;
GRANT ALL ON public.provider_payables TO service_role;

ALTER TABLE public.provider_payables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members select provider_payables" ON public.provider_payables
  FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "org members insert provider_payables" ON public.provider_payables
  FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update provider_payables" ON public.provider_payables
  FOR UPDATE TO authenticated USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete provider_payables" ON public.provider_payables
  FOR DELETE TO authenticated USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "super_admin all provider_payables" ON public.provider_payables
  FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER set_pp_updated_at BEFORE UPDATE ON public.provider_payables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Alter expense_occurrences: opcional link a provider_payable
ALTER TABLE public.expense_occurrences ADD COLUMN provider_payable_id uuid NULL;
CREATE UNIQUE INDEX uq_eo_provider_payable ON public.expense_occurrences(provider_payable_id)
  WHERE provider_payable_id IS NOT NULL;

-- 6) Triggers de sincronização financial_transactions <-> provider_payables
CREATE OR REPLACE FUNCTION public.sync_provider_payable_on_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.provider_payable_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.bank_id IS NOT DISTINCT FROM NEW.bank_id
     AND OLD.paid_at IS NOT DISTINCT FROM NEW.paid_at THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'pago' THEN
    UPDATE public.provider_payables
       SET status = 'paga',
           paid_at = COALESCE(NEW.paid_at::timestamptz, now()),
           bank_id = COALESCE(NEW.bank_id, bank_id),
           updated_at = now()
     WHERE id = NEW.provider_payable_id;
  ELSIF NEW.status = 'pendente' THEN
    UPDATE public.provider_payables
       SET status = 'lancada',
           paid_at = NULL,
           updated_at = now()
     WHERE id = NEW.provider_payable_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_provider_payable_on_tx
AFTER INSERT OR UPDATE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_provider_payable_on_tx();

CREATE OR REPLACE FUNCTION public.unlink_tx_on_provider_payable_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.financial_transaction_id IS NOT NULL THEN
    UPDATE public.financial_transactions
       SET provider_payable_id = NULL
     WHERE id = OLD.financial_transaction_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_unlink_tx_on_pp_delete
BEFORE DELETE ON public.provider_payables
FOR EACH ROW EXECUTE FUNCTION public.unlink_tx_on_provider_payable_delete();

-- 7) Views (SECURITY INVOKER respeita RLS das tabelas base)
CREATE OR REPLACE VIEW public.v_provider_summary
WITH (security_invoker = true) AS
SELECT
  p.organization_id,
  p.id AS provider_id,
  p.name AS provider_name,
  p.provider_type,
  p.status AS provider_status,
  COALESCE((
    SELECT SUM(
      CASE pa.frequency
        WHEN 'semanal' THEN pa.fixed_amount * 4.33
        WHEN 'quinzenal' THEN pa.fixed_amount * 2.17
        WHEN 'mensal' THEN pa.fixed_amount
        WHEN 'bimestral' THEN pa.fixed_amount / 2
        WHEN 'trimestral' THEN pa.fixed_amount / 3
        WHEN 'semestral' THEN pa.fixed_amount / 6
        WHEN 'anual' THEN pa.fixed_amount / 12
        ELSE 0
      END
    )
    FROM public.provider_assignments pa
    WHERE pa.provider_id = p.id AND pa.status = 'ativo'
      AND pa.assignment_type = 'recorrente'
      AND pa.compensation_type = 'valor_fixo'
  ), 0) AS recurring_monthly_cost,
  COALESCE((SELECT SUM(amount) FROM public.provider_payables pp
            WHERE pp.provider_id = p.id AND pp.status IN ('nao_lancada','lancada')
              AND pp.due_date >= CURRENT_DATE), 0) AS pending_amount,
  COALESCE((SELECT SUM(amount) FROM public.provider_payables pp
            WHERE pp.provider_id = p.id AND pp.status IN ('nao_lancada','lancada','vencida')
              AND pp.due_date < CURRENT_DATE), 0) AS overdue_amount,
  COALESCE((SELECT SUM(amount) FROM public.provider_payables pp
            WHERE pp.provider_id = p.id AND pp.status = 'paga'
              AND pp.paid_at >= date_trunc('month', CURRENT_DATE)), 0) AS paid_amount_period,
  COALESCE((SELECT SUM(amount) FROM public.provider_payables pp
            WHERE pp.provider_id = p.id AND pp.status = 'paga'), 0) AS total_paid,
  (SELECT COUNT(DISTINCT client_id) FROM public.provider_assignments pa
    WHERE pa.provider_id = p.id AND pa.client_id IS NOT NULL) AS linked_clients_count,
  (SELECT COUNT(DISTINCT service_id) FROM public.provider_assignments pa
    WHERE pa.provider_id = p.id AND pa.service_id IS NOT NULL) AS linked_services_count
FROM public.providers p;

GRANT SELECT ON public.v_provider_summary TO authenticated;

CREATE OR REPLACE VIEW public.v_client_profitability_summary
WITH (security_invoker = true) AS
SELECT
  c.organization_id,
  c.id AS client_id,
  COALESCE((SELECT SUM(amount_net) FROM public.financial_transactions ft
            WHERE ft.client_id = c.id AND ft.type IN ('receita_propria')
              AND ft.status = 'pago'), 0) AS paid_revenue,
  COALESCE((SELECT SUM(amount_net) FROM public.financial_transactions ft
            WHERE ft.client_id = c.id AND ft.type IN ('receita_propria')), 0) AS expected_revenue,
  COALESCE((SELECT SUM(amount) FROM public.provider_payables pp
            WHERE pp.client_id = c.id AND pp.status = 'paga'), 0) AS provider_costs_paid,
  COALESCE((SELECT SUM(amount) FROM public.provider_payables pp
            WHERE pp.client_id = c.id AND pp.status IN ('nao_lancada','lancada','vencida')), 0) AS provider_costs_expected,
  COALESCE((SELECT SUM(amount_gross) FROM public.financial_transactions ft
            WHERE ft.client_id = c.id AND ft.type = 'despesa_propria'
              AND ft.status = 'pago' AND ft.provider_payable_id IS NULL), 0) AS other_costs_paid,
  0::numeric AS fees_paid,
  COALESCE((SELECT SUM(cashback_received) FROM public.financial_transactions ft
            WHERE ft.client_id = c.id), 0) AS cashback_received
FROM public.clients c;

GRANT SELECT ON public.v_client_profitability_summary TO authenticated;

CREATE OR REPLACE VIEW public.v_service_profitability_summary
WITH (security_invoker = true) AS
SELECT
  s.organization_id,
  s.id AS service_id,
  COALESCE((SELECT SUM(amount_net) FROM public.financial_transactions ft
            WHERE ft.service_id = s.id AND ft.type = 'receita_propria'
              AND ft.status = 'pago'), 0) AS paid_revenue,
  COALESCE((SELECT SUM(amount_net) FROM public.financial_transactions ft
            WHERE ft.service_id = s.id AND ft.type = 'receita_propria'), 0) AS expected_revenue,
  COALESCE((SELECT SUM(amount) FROM public.provider_payables pp
            WHERE pp.service_id = s.id AND pp.status = 'paga'), 0) AS provider_costs_paid,
  COALESCE((SELECT SUM(amount) FROM public.provider_payables pp
            WHERE pp.service_id = s.id AND pp.status IN ('nao_lancada','lancada','vencida')), 0) AS provider_costs_expected
FROM public.services s;

GRANT SELECT ON public.v_service_profitability_summary TO authenticated;
