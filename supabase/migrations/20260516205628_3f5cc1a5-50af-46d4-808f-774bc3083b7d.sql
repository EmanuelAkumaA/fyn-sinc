
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'financeiro', 'gerente', 'operacional', 'visualizador');
CREATE TYPE public.client_type AS ENUM ('PF', 'PJ');
CREATE TYPE public.client_status AS ENUM ('ativo', 'inativo', 'inadimplente');
CREATE TYPE public.service_type AS ENUM ('avulso', 'recorrente');
CREATE TYPE public.entity_status AS ENUM ('ativo', 'inativo', 'pausado', 'cancelado');
CREATE TYPE public.transaction_type AS ENUM (
  'receita_propria','despesa_propria','repasse_recebido','uso_repasse',
  'comissao','cashback','taxa','transferencia'
);
CREATE TYPE public.transaction_status AS ENUM ('pendente','pago','atrasado','cancelado');
CREATE TYPE public.recurrence_freq AS ENUM ('semanal','quinzenal','mensal','trimestral','semestral','anual');
CREATE TYPE public.plan_status AS ENUM ('pendente','recebido','pago_fornecedor','concluido','cancelado');

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ ORGANIZATIONS ============
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.organization_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_org_users_user ON public.organization_users(user_id);
CREATE INDEX idx_org_users_org ON public.organization_users(organization_id);
CREATE TRIGGER trg_org_users_updated BEFORE UPDATE ON public.organization_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MEMBERSHIP HELPER ============
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_users
    WHERE organization_id = _org_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_users
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC LIMIT 1;
$$;

-- ============ ORGS RLS ============
CREATE POLICY "org members read org" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "org members update org" ON public.organizations
  FOR UPDATE TO authenticated USING (public.is_org_member(id));

CREATE POLICY "user reads own membership" ON public.organization_users
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_org_member(organization_id));

-- ============ AUTO PROVISION ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _name text;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'company_name', NEW.raw_user_meta_data->>'name', 'Minha Empresa');
  INSERT INTO public.organizations (name) VALUES (_name) RETURNING id INTO _org_id;
  INSERT INTO public.organization_users (organization_id, user_id, role) VALUES (_org_id, NEW.id, 'admin');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ GENERIC ORG-SCOPED TABLES ============

-- Clients
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.client_type NOT NULL DEFAULT 'PJ',
  document text,
  email text,
  phone text,
  company text,
  status public.client_status NOT NULL DEFAULT 'ativo',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_clients_org ON public.clients(organization_id);
CREATE INDEX idx_clients_status ON public.clients(status);
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Banks
CREATE TABLE public.banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_type text,
  initial_balance numeric(14,2) NOT NULL DEFAULT 0,
  color text,
  status public.entity_status NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_banks_org ON public.banks(organization_id);
CREATE TRIGGER trg_banks_updated BEFORE UPDATE ON public.banks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Services
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  description text,
  default_value numeric(14,2),
  type public.service_type NOT NULL DEFAULT 'avulso',
  status public.entity_status NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_services_org ON public.services(organization_id);
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Recurring contracts
CREATE TABLE public.recurring_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  description text,
  amount numeric(14,2) NOT NULL,
  frequency public.recurrence_freq NOT NULL DEFAULT 'mensal',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_due_date date NOT NULL,
  default_bank_id uuid REFERENCES public.banks(id) ON DELETE SET NULL,
  status public.entity_status NOT NULL DEFAULT 'ativo',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_contracts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_recurring_org ON public.recurring_contracts(organization_id);
CREATE INDEX idx_recurring_client ON public.recurring_contracts(client_id);
CREATE TRIGGER trg_recurring_updated BEFORE UPDATE ON public.recurring_contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Financial transactions
CREATE TABLE public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  bank_id uuid REFERENCES public.banks(id) ON DELETE SET NULL,
  transfer_to_bank_id uuid REFERENCES public.banks(id) ON DELETE SET NULL,
  recurring_contract_id uuid REFERENCES public.recurring_contracts(id) ON DELETE SET NULL,
  parent_transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
  third_party_plan_id uuid,
  description text NOT NULL,
  category text,
  platform text, -- google_ads, meta_ads, tiktok_ads, linkedin_ads, outro
  fornecedor text, -- Asaas, Stripe, Mercado Pago etc.
  amount_gross numeric(14,2) NOT NULL,
  amount_net numeric(14,2),
  due_date date,
  paid_at date,
  status public.transaction_status NOT NULL DEFAULT 'pendente',
  payment_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ft_org ON public.financial_transactions(organization_id);
CREATE INDEX idx_ft_client ON public.financial_transactions(client_id);
CREATE INDEX idx_ft_type ON public.financial_transactions(type);
CREATE INDEX idx_ft_status ON public.financial_transactions(status);
CREATE INDEX idx_ft_due ON public.financial_transactions(due_date);
CREATE INDEX idx_ft_paid ON public.financial_transactions(paid_at);
CREATE INDEX idx_ft_platform ON public.financial_transactions(platform);
CREATE INDEX idx_ft_parent ON public.financial_transactions(parent_transaction_id);
CREATE TRIGGER trg_ft_updated BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Third party plans
CREATE TABLE public.third_party_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  fornecedor text NOT NULL,
  plan_name text NOT NULL,
  period text,
  full_value numeric(14,2),
  amount_received_from_client numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid_to_supplier numeric(14,2) NOT NULL DEFAULT 0,
  commission_pct numeric(5,2) NOT NULL DEFAULT 0,
  commission_value numeric(14,2) NOT NULL DEFAULT 0,
  cashback_expected numeric(14,2) NOT NULL DEFAULT 0,
  cashback_received numeric(14,2) NOT NULL DEFAULT 0,
  payment_method text,
  bank_id uuid REFERENCES public.banks(id) ON DELETE SET NULL,
  status public.plan_status NOT NULL DEFAULT 'pendente',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.third_party_plans ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tpp_org ON public.third_party_plans(organization_id);
CREATE INDEX idx_tpp_client ON public.third_party_plans(client_id);
CREATE TRIGGER trg_tpp_updated BEFORE UPDATE ON public.third_party_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STANDARD ORG RLS POLICIES ============
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'clients','banks','services','recurring_contracts','financial_transactions','third_party_plans'
  ])
  LOOP
    EXECUTE format('CREATE POLICY "org members select %1$s" ON public.%1$s FOR SELECT TO authenticated USING (public.is_org_member(organization_id));', t);
    EXECUTE format('CREATE POLICY "org members insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));', t);
    EXECUTE format('CREATE POLICY "org members update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (public.is_org_member(organization_id));', t);
    EXECUTE format('CREATE POLICY "org members delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (public.is_org_member(organization_id));', t);
  END LOOP;
END $$;

-- ============ VIEWS ============
CREATE OR REPLACE VIEW public.v_bank_balance AS
SELECT
  b.id AS bank_id,
  b.organization_id,
  b.name,
  b.color,
  b.initial_balance
    + COALESCE((SELECT SUM(amount_gross) FROM public.financial_transactions ft
                WHERE ft.bank_id = b.id AND ft.status='pago'
                  AND ft.type IN ('receita_propria','repasse_recebido','comissao','cashback')), 0)
    - COALESCE((SELECT SUM(amount_gross) FROM public.financial_transactions ft
                WHERE ft.bank_id = b.id AND ft.status='pago'
                  AND ft.type IN ('despesa_propria','uso_repasse','taxa')), 0)
    + COALESCE((SELECT SUM(amount_gross) FROM public.financial_transactions ft
                WHERE ft.transfer_to_bank_id = b.id AND ft.status='pago' AND ft.type='transferencia'), 0)
    - COALESCE((SELECT SUM(amount_gross) FROM public.financial_transactions ft
                WHERE ft.bank_id = b.id AND ft.status='pago' AND ft.type='transferencia'), 0)
    AS current_balance
FROM public.banks b;

CREATE OR REPLACE VIEW public.v_client_wallet AS
SELECT
  c.organization_id,
  c.id AS client_id,
  c.name AS client_name,
  COALESCE(ft.platform,'') AS platform,
  COALESCE(SUM(CASE WHEN ft.type='repasse_recebido' THEN ft.amount_gross ELSE 0 END),0) AS total_received,
  COALESCE(SUM(CASE WHEN ft.type='uso_repasse' THEN ft.amount_gross ELSE 0 END),0) AS total_used,
  COALESCE(SUM(CASE WHEN ft.type='repasse_recebido' THEN ft.amount_gross ELSE 0 END),0)
    - COALESCE(SUM(CASE WHEN ft.type='uso_repasse' THEN ft.amount_gross ELSE 0 END),0) AS available_balance
FROM public.clients c
LEFT JOIN public.financial_transactions ft
  ON ft.client_id = c.id AND ft.type IN ('repasse_recebido','uso_repasse')
GROUP BY c.organization_id, c.id, c.name, ft.platform;
