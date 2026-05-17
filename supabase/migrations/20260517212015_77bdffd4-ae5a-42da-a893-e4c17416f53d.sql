
-- =========================================================
-- 1. ROLES GLOBAIS
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

-- =========================================================
-- 2. ORG ROLES E MEMBROS
-- =========================================================
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

-- super_admin pode ler membros
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

-- =========================================================
-- 3. ORGANIZATIONS — campos de plano/trial
-- =========================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial','active','suspended','expired','canceled')),
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial','starter','professional','enterprise')),
  ADD COLUMN IF NOT EXISTS trial_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz;

-- Política super_admin em organizations
DROP POLICY IF EXISTS "super_admin manages organizations" ON public.organizations;
CREATE POLICY "super_admin manages organizations"
  ON public.organizations FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- =========================================================
-- 4. TRIAL REQUESTS
-- =========================================================
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
ALTER TABLE public.trial_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin reads trial_requests" ON public.trial_requests;
CREATE POLICY "super_admin reads trial_requests"
  ON public.trial_requests FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- =========================================================
-- 5. POLÍTICAS SUPER_ADMIN NAS TABELAS OPERACIONAIS
-- =========================================================
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

-- =========================================================
-- 6. SEED KUMA TECH
-- =========================================================
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
