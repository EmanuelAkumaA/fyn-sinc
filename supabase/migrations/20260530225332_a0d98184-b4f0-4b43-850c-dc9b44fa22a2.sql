
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
  platform text,
  fornecedor text,
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

-- ============ GRANTS for org-scoped tables ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_users TO authenticated;
GRANT ALL ON public.organization_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banks TO authenticated;
GRANT ALL ON public.banks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_contracts TO authenticated;
GRANT ALL ON public.recurring_contracts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_transactions TO authenticated;
GRANT ALL ON public.financial_transactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.third_party_plans TO authenticated;
GRANT ALL ON public.third_party_plans TO service_role;

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

ALTER VIEW public.v_bank_balance SET (security_invoker = true);
ALTER VIEW public.v_client_wallet SET (security_invoker = true);

ALTER FUNCTION public.set_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS brand_color text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-logos',
  'client-logos',
  true,
  2097152,
  array['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "client-logos public read"
on storage.objects for select
using (bucket_id = 'client-logos');

create policy "client-logos org members insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'client-logos'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);

create policy "client-logos org members update"
on storage.objects for update to authenticated
using (
  bucket_id = 'client-logos'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);

create policy "client-logos org members delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'client-logos'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);

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

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;

-- =========================================================
-- CLIENT DOCUMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_id uuid NOT NULL,
  document_type text NOT NULL,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_path text NOT NULL,
  file_name text,
  file_size bigint,
  mime_type text,
  related_transaction_id uuid,
  related_recurring_id uuid,
  document_date date,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_documents_client ON public.client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_org ON public.client_documents(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_documents TO authenticated;
GRANT ALL ON public.client_documents TO service_role;

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members select client_documents" ON public.client_documents
  FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "org members insert client_documents" ON public.client_documents
  FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "org members update client_documents" ON public.client_documents
  FOR UPDATE TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "org members delete client_documents" ON public.client_documents
  FOR DELETE TO authenticated USING (is_org_member(organization_id));

CREATE TRIGGER trg_client_documents_updated_at
  BEFORE UPDATE ON public.client_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- CLIENT FINANCIAL SUMMARY VIEW
-- =========================================================
CREATE OR REPLACE VIEW public.v_client_financial_summary
WITH (security_invoker = true) AS
WITH tx_agg AS (
  SELECT
    t.organization_id,
    t.client_id,
    COALESCE(SUM(CASE WHEN t.type IN ('receita_propria','comissao','cashback') AND t.status = 'pago' THEN t.amount_gross ELSE 0 END), 0) AS total_received,
    COALESCE(SUM(CASE WHEN t.type = 'receita_propria' AND t.status = 'pendente' AND t.due_date IS NOT NULL AND t.due_date >= CURRENT_DATE THEN t.amount_gross ELSE 0 END), 0) AS total_receivable,
    COALESCE(SUM(CASE WHEN t.type = 'receita_propria' AND t.status = 'pendente' AND t.due_date IS NOT NULL AND t.due_date <  CURRENT_DATE THEN t.amount_gross ELSE 0 END), 0) AS total_overdue,
    COALESCE(SUM(CASE WHEN t.type = 'receita_propria' AND t.status = 'pendente' AND t.recurring_contract_id IS NULL THEN t.amount_gross ELSE 0 END), 0) AS pending_one_time_amount,
    COALESCE(SUM(CASE WHEN t.type = 'repasse_recebido' AND t.status = 'pago' THEN t.amount_gross ELSE 0 END), 0) AS total_repasse_received,
    COALESCE(SUM(CASE WHEN t.type = 'uso_repasse'      AND t.status = 'pago' THEN t.amount_gross ELSE 0 END), 0) AS total_repasse_used,
    COALESCE(SUM(CASE WHEN t.type = 'comissao' AND t.status = 'pago' THEN t.amount_gross ELSE 0 END), 0) AS total_commissions,
    COALESCE(SUM(CASE WHEN t.type = 'cashback' AND t.status = 'pago' THEN t.amount_gross ELSE 0 END), 0) AS total_cashbacks,
    COALESCE(SUM(CASE WHEN t.type = 'taxa'           AND t.status = 'pago' THEN t.amount_gross ELSE 0 END), 0) AS total_fees,
    COALESCE(SUM(CASE WHEN t.type = 'despesa_propria' AND t.status = 'pago' THEN t.amount_gross ELSE 0 END), 0) AS total_expenses
  FROM public.financial_transactions t
  WHERE t.client_id IS NOT NULL
  GROUP BY t.organization_id, t.client_id
),
rec_agg AS (
  SELECT
    r.organization_id,
    r.client_id,
    COALESCE(SUM(CASE WHEN r.status = 'ativo' THEN r.amount ELSE 0 END), 0) AS active_recurring_amount,
    COALESCE(SUM(CASE WHEN r.status = 'ativo' AND r.next_due_date IS NOT NULL
                       AND r.next_due_date >= date_trunc('month', CURRENT_DATE)
                       AND r.next_due_date <  (date_trunc('month', CURRENT_DATE) + interval '1 month')
                  THEN r.amount ELSE 0 END), 0) AS expected_recurring_month
  FROM public.recurring_contracts r
  GROUP BY r.organization_id, r.client_id
)
SELECT
  c.organization_id,
  c.id AS client_id,
  COALESCE(tx.total_received,           0) AS total_received,
  COALESCE(tx.total_receivable,         0) AS total_receivable,
  COALESCE(tx.total_overdue,            0) AS total_overdue,
  COALESCE(re.active_recurring_amount,  0) AS active_recurring_amount,
  COALESCE(re.expected_recurring_month, 0) AS expected_recurring_month,
  COALESCE(tx.pending_one_time_amount,  0) AS pending_one_time_amount,
  COALESCE(tx.total_repasse_received,   0) AS total_repasse_received,
  COALESCE(tx.total_repasse_used,       0) AS total_repasse_used,
  COALESCE(tx.total_repasse_received,0) - COALESCE(tx.total_repasse_used,0) AS repasse_balance,
  COALESCE(tx.total_commissions,        0) AS total_commissions,
  COALESCE(tx.total_cashbacks,          0) AS total_cashbacks,
  COALESCE(tx.total_fees,               0) AS total_fees,
  COALESCE(tx.total_expenses,           0) AS total_expenses,
  ( COALESCE(tx.total_received,0)
    - COALESCE(tx.total_fees,0)
    - COALESCE(tx.total_expenses,0)
  ) AS client_net_profit
FROM public.clients c
LEFT JOIN tx_agg tx ON tx.organization_id = c.organization_id AND tx.client_id = c.id
LEFT JOIN rec_agg re ON re.organization_id = c.organization_id AND re.client_id = c.id;

-- =========================================================
-- STORAGE BUCKET client-documents (private)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "org members read client-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND is_org_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "org members insert client-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND is_org_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "org members update client-documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND is_org_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "org members delete client-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND is_org_member(((storage.foldername(name))[1])::uuid)
  );

-- =========================================================
-- ROLES GLOBAIS + ORG ROLES
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.global_role AS ENUM ('super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_global_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role public.global_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_global_roles TO authenticated;
GRANT ALL ON public.user_global_roles TO service_role;

ALTER TABLE public.user_global_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own global role" ON public.user_global_roles;
CREATE POLICY "users read own global role"
  ON public.user_global_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_global_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('owner', 'manager', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.organization_users
  ADD COLUMN IF NOT EXISTS member_role public.org_role NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive'));

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id uuid, _roles public.org_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.organization_users
    WHERE organization_id = _org_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND member_role = ANY(_roles)
  );
$$;

DROP POLICY IF EXISTS "super_admin reads all memberships" ON public.organization_users;
CREATE POLICY "super_admin reads all memberships"
  ON public.organization_users FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "super_admin manages memberships" ON public.organization_users;
CREATE POLICY "super_admin manages memberships"
  ON public.organization_users FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- organizations: trial/plan
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial','active','suspended','expired','canceled')),
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial','starter','professional','enterprise')),
  ADD COLUMN IF NOT EXISTS trial_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz;

DROP POLICY IF EXISTS "super_admin manages organizations" ON public.organizations;
CREATE POLICY "super_admin manages organizations"
  ON public.organizations FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- trial_requests
CREATE TABLE IF NOT EXISTS public.trial_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  responsible_name text NOT NULL,
  email text NOT NULL,
  whatsapp text,
  company_name text NOT NULL,
  segment text,
  clients_estimate text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.trial_requests TO anon, authenticated;
GRANT ALL ON public.trial_requests TO service_role;

ALTER TABLE public.trial_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin reads trial_requests" ON public.trial_requests;
CREATE POLICY "super_admin reads trial_requests"
  ON public.trial_requests FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- super_admin nas tabelas operacionais
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','financial_transactions','recurring_contracts','services','banks','third_party_plans','client_documents']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "super_admin all %1$s" ON public.%1$s', t);
    EXECUTE format($f$
      CREATE POLICY "super_admin all %1$s"
        ON public.%1$s FOR ALL
        TO authenticated
        USING (public.is_super_admin(auth.uid()))
        WITH CHECK (public.is_super_admin(auth.uid()))
    $f$, t);
  END LOOP;
END $$;

-- Seed Kuma Tech (sem usuários)
INSERT INTO public.organizations (name, status, plan)
SELECT 'Kuma Tech', 'active', 'enterprise'
WHERE NOT EXISTS (SELECT 1 FROM public.organizations WHERE lower(name) = 'kuma tech');

UPDATE public.organizations
SET status = 'active', plan = 'enterprise'
WHERE lower(name) = 'kuma tech';

CREATE OR REPLACE FUNCTION public.link_super_admin_by_email(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _org_id uuid;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _user_id IS NULL THEN
    RAISE NOTICE 'Usuário % ainda não existe no Auth. Crie a conta e rode a função novamente.', _email;
    RETURN;
  END IF;

  INSERT INTO public.user_global_roles (user_id, role)
  VALUES (_user_id, 'super_admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin', updated_at = now();

  SELECT id INTO _org_id FROM public.organizations WHERE lower(name) = 'kuma tech' LIMIT 1;
  IF _org_id IS NOT NULL THEN
    INSERT INTO public.organization_users (organization_id, user_id, role, member_role, status)
    VALUES (_org_id, _user_id, 'admin', 'owner', 'active')
    ON CONFLICT DO NOTHING;
    UPDATE public.organization_users
      SET member_role = 'owner', status = 'active'
      WHERE organization_id = _org_id AND user_id = _user_id;
  END IF;
END $$;

SELECT public.link_super_admin_by_email('kumatech4@gmail.com');

-- is_org_active helper
CREATE OR REPLACE FUNCTION public.is_org_active(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = _org_id
        AND (
          o.status = 'active'
          OR (
            o.status = 'trial'
            AND (o.trial_ends_at IS NULL OR o.trial_ends_at > now())
          )
        )
    );
$$;

-- Recreate write policies with is_org_active gate
DROP POLICY IF EXISTS "org members insert clients" ON public.clients;
DROP POLICY IF EXISTS "org members update clients" ON public.clients;
DROP POLICY IF EXISTS "org members delete clients" ON public.clients;
CREATE POLICY "org members insert clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update clients" ON public.clients FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete clients" ON public.clients FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));

DROP POLICY IF EXISTS "org members insert banks" ON public.banks;
DROP POLICY IF EXISTS "org members update banks" ON public.banks;
DROP POLICY IF EXISTS "org members delete banks" ON public.banks;
CREATE POLICY "org members insert banks" ON public.banks FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update banks" ON public.banks FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete banks" ON public.banks FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));

DROP POLICY IF EXISTS "org members insert services" ON public.services;
DROP POLICY IF EXISTS "org members update services" ON public.services;
DROP POLICY IF EXISTS "org members delete services" ON public.services;
CREATE POLICY "org members insert services" ON public.services FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update services" ON public.services FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete services" ON public.services FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));

DROP POLICY IF EXISTS "org members insert recurring_contracts" ON public.recurring_contracts;
DROP POLICY IF EXISTS "org members update recurring_contracts" ON public.recurring_contracts;
DROP POLICY IF EXISTS "org members delete recurring_contracts" ON public.recurring_contracts;
CREATE POLICY "org members insert recurring_contracts" ON public.recurring_contracts FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update recurring_contracts" ON public.recurring_contracts FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete recurring_contracts" ON public.recurring_contracts FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));

DROP POLICY IF EXISTS "org members insert third_party_plans" ON public.third_party_plans;
DROP POLICY IF EXISTS "org members update third_party_plans" ON public.third_party_plans;
DROP POLICY IF EXISTS "org members delete third_party_plans" ON public.third_party_plans;
CREATE POLICY "org members insert third_party_plans" ON public.third_party_plans FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update third_party_plans" ON public.third_party_plans FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete third_party_plans" ON public.third_party_plans FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));

DROP POLICY IF EXISTS "org members insert financial_transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "org members update financial_transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "org members delete financial_transactions" ON public.financial_transactions;
CREATE POLICY "org members insert financial_transactions" ON public.financial_transactions FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update financial_transactions" ON public.financial_transactions FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete financial_transactions" ON public.financial_transactions FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));

DROP POLICY IF EXISTS "org members insert client_documents" ON public.client_documents;
DROP POLICY IF EXISTS "org members update client_documents" ON public.client_documents;
DROP POLICY IF EXISTS "org members delete client_documents" ON public.client_documents;
CREATE POLICY "org members insert client_documents" ON public.client_documents FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update client_documents" ON public.client_documents FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete client_documents" ON public.client_documents FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));

-- Onda 1: hardening
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

DROP POLICY IF EXISTS "anyone can request trial" ON public.trial_requests;
CREATE POLICY "anyone can request trial"
  ON public.trial_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

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

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.banks ADD COLUMN IF NOT EXISTS logo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-logos', 'bank-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "bank-logos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'bank-logos');

CREATE POLICY "bank-logos org members upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bank-logos'
  AND public.is_org_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "bank-logos org members update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'bank-logos'
  AND public.is_org_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "bank-logos org members delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'bank-logos'
  AND public.is_org_member(((storage.foldername(name))[1])::uuid)
);

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

-- platforms
CREATE TABLE public.platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platforms TO authenticated;
GRANT ALL ON public.platforms TO service_role;

ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members select platforms" ON public.platforms
  FOR SELECT TO authenticated USING (is_org_member(organization_id));

CREATE POLICY "org members insert platforms" ON public.platforms
  FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));

CREATE POLICY "org members update platforms" ON public.platforms
  FOR UPDATE TO authenticated USING (is_org_member(organization_id) AND is_org_active(organization_id));

CREATE POLICY "org members delete platforms" ON public.platforms
  FOR DELETE TO authenticated USING (is_org_member(organization_id) AND is_org_active(organization_id));

CREATE POLICY "super_admin all platforms" ON public.platforms
  FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "super_admin inserts global roles" ON public.user_global_roles
  FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "super_admin updates global roles" ON public.user_global_roles
  FOR UPDATE TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "super_admin deletes global roles" ON public.user_global_roles
  FOR DELETE TO authenticated USING (is_super_admin(auth.uid()));

-- v_bank_balance_breakdown
CREATE OR REPLACE VIEW public.v_bank_balance_breakdown
WITH (security_invoker = on)
AS
SELECT
  b.id AS bank_id,
  b.organization_id,
  b.name AS bank_name,
  b.account_type AS bank_type,
  b.status,
  b.color,
  b.logo_url,
  b.initial_balance,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='receita_propria'),0) AS income_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='despesa_propria'),0) AS expense_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='comissao'),0) AS commission_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='cashback'),0) AS cashback_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='taxa'),0) AS fees_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='repasse_recebido'),0) AS repasse_received_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='uso_repasse'),0) AS repasse_used_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.transfer_to_bank_id=b.id AND ft.status='pago' AND ft.type='transferencia'),0) AS transfer_in_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='transferencia'),0) AS transfer_out_total
FROM public.banks b;

DROP POLICY IF EXISTS "org members update org" ON public.organizations;
CREATE POLICY "org owners/managers update org"
ON public.organizations
FOR UPDATE
TO authenticated
USING (public.has_org_role(id, ARRAY['owner','manager']::org_role[]))
WITH CHECK (public.has_org_role(id, ARRAY['owner','manager']::org_role[]));

-- v_service_summary (final version)
CREATE OR REPLACE VIEW public.v_service_summary
WITH (security_invoker = true) AS
WITH paid AS (
  SELECT service_id, organization_id, client_id, amount_gross
  FROM public.financial_transactions
  WHERE type = 'receita_propria' AND status = 'pago' AND service_id IS NOT NULL
),
pending AS (
  SELECT service_id, organization_id, amount_gross, due_date
  FROM public.financial_transactions
  WHERE type = 'receita_propria' AND status = 'pendente' AND service_id IS NOT NULL
),
clients_tx AS (
  SELECT DISTINCT service_id, organization_id, client_id
  FROM public.financial_transactions
  WHERE service_id IS NOT NULL AND client_id IS NOT NULL
),
clients_rec AS (
  SELECT DISTINCT service_id, organization_id, client_id
  FROM public.recurring_contracts
  WHERE service_id IS NOT NULL AND client_id IS NOT NULL
),
all_clients AS (
  SELECT * FROM clients_tx
  UNION
  SELECT * FROM clients_rec
),
all_clients_status AS (
  SELECT DISTINCT ac.service_id, ac.client_id, c.client_status
  FROM all_clients ac
  JOIN public.clients c ON c.id = ac.client_id
),
rec_mrr AS (
  SELECT
    service_id,
    organization_id,
    COUNT(*) AS active_recurring_count,
    SUM(amount * CASE frequency::text
      WHEN 'semanal' THEN 4
      WHEN 'quinzenal' THEN 2
      WHEN 'mensal' THEN 1
      WHEN 'bimestral' THEN 0.5
      WHEN 'trimestral' THEN 1.0/3
      WHEN 'semestral' THEN 1.0/6
      WHEN 'anual' THEN 1.0/12
      ELSE 1
    END) AS active_mrr
  FROM public.recurring_contracts
  WHERE status = 'ativo' AND service_id IS NOT NULL
  GROUP BY service_id, organization_id
)
SELECT
  s.id AS service_id,
  s.organization_id,
  s.name AS service_name,
  s.type AS service_type,
  s.category,
  s.status,
  s.default_value,
  s.description,
  COALESCE((SELECT COUNT(DISTINCT client_id) FROM all_clients_status a WHERE a.service_id = s.id AND a.client_status = 'ativo'), 0) AS active_clients_count,
  COALESCE((SELECT COUNT(DISTINCT client_id) FROM all_clients_status a WHERE a.service_id = s.id), 0) AS total_clients_count,
  COALESCE((SELECT COUNT(DISTINCT client_id) FROM all_clients_status a WHERE a.service_id = s.id AND a.client_status = 'inativo'), 0) AS inactive_clients_count,
  COALESCE((SELECT SUM(amount_gross) FROM paid p WHERE p.service_id = s.id), 0) AS total_revenue,
  COALESCE((SELECT COUNT(*) FROM paid p WHERE p.service_id = s.id), 0) AS paid_transactions_count,
  COALESCE((SELECT SUM(amount_gross) FROM paid p WHERE p.service_id = s.id), 0)
    / NULLIF((SELECT COUNT(*) FROM paid p WHERE p.service_id = s.id), 0) AS average_ticket,
  COALESCE((SELECT SUM(amount_gross) FROM pending pe WHERE pe.service_id = s.id AND pe.due_date < CURRENT_DATE), 0) AS overdue_amount,
  COALESCE((SELECT SUM(amount_gross) FROM pending pe WHERE pe.service_id = s.id), 0) AS pending_amount,
  COALESCE(rm.active_recurring_count, 0) AS active_recurring_count,
  COALESCE(rm.active_mrr, 0) AS active_mrr
FROM public.services s
LEFT JOIN rec_mrr rm ON rm.service_id = s.id;

GRANT SELECT ON public.v_service_summary TO authenticated;

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS cashback_expected numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_received numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_received_at date,
  ADD COLUMN IF NOT EXISTS cashback_bank_id uuid,
  ADD COLUMN IF NOT EXISTS cashback_status text NOT NULL DEFAULT 'nenhum';

-- ============================================================
-- Despesas & Planejamento
-- ============================================================
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

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS expense_occurrence_id uuid;
CREATE INDEX IF NOT EXISTS idx_financial_transactions_expense_occ
  ON public.financial_transactions(expense_occurrence_id);

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

-- =====================================================
-- EQUIPE & PRESTADORES — V1
-- =====================================================
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

ALTER TABLE public.financial_transactions ADD COLUMN provider_payable_id uuid NULL;
CREATE INDEX idx_ft_provider_payable ON public.financial_transactions(provider_payable_id);

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

ALTER TABLE public.expense_occurrences ADD COLUMN provider_payable_id uuid NULL;
CREATE UNIQUE INDEX uq_eo_provider_payable ON public.expense_occurrences(provider_payable_id)
  WHERE provider_payable_id IS NOT NULL;

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
