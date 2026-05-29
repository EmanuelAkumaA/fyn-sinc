
-- ============================================================
-- Despesas & Planejamento
-- ============================================================

-- 1) Categorias
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  classification text NOT NULL DEFAULT 'operacional'
    CHECK (classification IN ('operacional','investimento','equipe','financeiro','infraestrutura','marketing','personalizado')),
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expense_categories_org ON public.expense_categories(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members select expense_categories" ON public.expense_categories
  FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "org members insert expense_categories" ON public.expense_categories
  FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update expense_categories" ON public.expense_categories
  FOR UPDATE TO authenticated USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete expense_categories" ON public.expense_categories
  FOR DELETE TO authenticated USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "super_admin all expense_categories" ON public.expense_categories
  FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Planos de despesa
CREATE TABLE public.expense_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  expense_type text NOT NULL CHECK (expense_type IN ('fixa','variavel','investimento')),
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  frequency text CHECK (frequency IN ('unica','semanal','quinzenal','mensal','bimestral','trimestral','semestral','anual')),
  due_day integer CHECK (due_day IS NULL OR (due_day BETWEEN 1 AND 31)),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  default_bank_id uuid,
  client_id uuid,
  service_id uuid,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','cancelado')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expense_plans_org ON public.expense_plans(organization_id);
CREATE INDEX idx_expense_plans_status ON public.expense_plans(organization_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_plans TO authenticated;
GRANT ALL ON public.expense_plans TO service_role;

ALTER TABLE public.expense_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members select expense_plans" ON public.expense_plans
  FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "org members insert expense_plans" ON public.expense_plans
  FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update expense_plans" ON public.expense_plans
  FOR UPDATE TO authenticated USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete expense_plans" ON public.expense_plans
  FOR DELETE TO authenticated USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "super_admin all expense_plans" ON public.expense_plans
  FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_expense_plans_updated_at
  BEFORE UPDATE ON public.expense_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Ocorrências
CREATE TABLE public.expense_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  expense_plan_id uuid NOT NULL REFERENCES public.expense_plans(id) ON DELETE CASCADE,
  financial_transaction_id uuid,
  reference_month date,
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'nao_lancada'
    CHECK (status IN ('nao_lancada','lancada','paga','vencida','pausada','cancelada')),
  launched_at timestamptz,
  paid_at timestamptz,
  bank_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expense_plan_id, reference_month)
);
CREATE INDEX idx_expense_occurrences_org_due ON public.expense_occurrences(organization_id, due_date);
CREATE INDEX idx_expense_occurrences_plan ON public.expense_occurrences(expense_plan_id);
CREATE INDEX idx_expense_occurrences_tx ON public.expense_occurrences(financial_transaction_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_occurrences TO authenticated;
GRANT ALL ON public.expense_occurrences TO service_role;

ALTER TABLE public.expense_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members select expense_occurrences" ON public.expense_occurrences
  FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "org members insert expense_occurrences" ON public.expense_occurrences
  FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update expense_occurrences" ON public.expense_occurrences
  FOR UPDATE TO authenticated USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete expense_occurrences" ON public.expense_occurrences
  FOR DELETE TO authenticated USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "super_admin all expense_occurrences" ON public.expense_occurrences
  FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_expense_occurrences_updated_at
  BEFORE UPDATE ON public.expense_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Vínculo reverso em financial_transactions
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS expense_occurrence_id uuid;
CREATE INDEX IF NOT EXISTS idx_financial_transactions_expense_occ
  ON public.financial_transactions(expense_occurrence_id);

-- 5) Trigger: sincroniza status da ocorrência conforme financial_transaction
CREATE OR REPLACE FUNCTION public.sync_expense_occurrence_on_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_sync_expense_occurrence_on_tx ON public.financial_transactions;
CREATE TRIGGER trg_sync_expense_occurrence_on_tx
  AFTER INSERT OR UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_expense_occurrence_on_tx();

-- 6) Trigger: se ocorrência é deletada, desvincula transação (não apaga)
CREATE OR REPLACE FUNCTION public.unlink_tx_on_occurrence_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.financial_transaction_id IS NOT NULL THEN
    UPDATE public.financial_transactions
       SET expense_occurrence_id = NULL
     WHERE id = OLD.financial_transaction_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_unlink_tx_on_occurrence_delete ON public.expense_occurrences;
CREATE TRIGGER trg_unlink_tx_on_occurrence_delete
  BEFORE DELETE ON public.expense_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.unlink_tx_on_occurrence_delete();
