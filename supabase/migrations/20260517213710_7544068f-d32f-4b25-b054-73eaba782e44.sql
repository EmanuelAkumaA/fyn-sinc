-- 1. is_org_active helper
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

-- 2. Recreate write policies for operational tables with is_org_active gate

-- clients
DROP POLICY IF EXISTS "org members insert clients" ON public.clients;
DROP POLICY IF EXISTS "org members update clients" ON public.clients;
DROP POLICY IF EXISTS "org members delete clients" ON public.clients;
CREATE POLICY "org members insert clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update clients" ON public.clients FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete clients" ON public.clients FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));

-- banks
DROP POLICY IF EXISTS "org members insert banks" ON public.banks;
DROP POLICY IF EXISTS "org members update banks" ON public.banks;
DROP POLICY IF EXISTS "org members delete banks" ON public.banks;
CREATE POLICY "org members insert banks" ON public.banks FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update banks" ON public.banks FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete banks" ON public.banks FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));

-- services
DROP POLICY IF EXISTS "org members insert services" ON public.services;
DROP POLICY IF EXISTS "org members update services" ON public.services;
DROP POLICY IF EXISTS "org members delete services" ON public.services;
CREATE POLICY "org members insert services" ON public.services FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update services" ON public.services FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete services" ON public.services FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));

-- recurring_contracts
DROP POLICY IF EXISTS "org members insert recurring_contracts" ON public.recurring_contracts;
DROP POLICY IF EXISTS "org members update recurring_contracts" ON public.recurring_contracts;
DROP POLICY IF EXISTS "org members delete recurring_contracts" ON public.recurring_contracts;
CREATE POLICY "org members insert recurring_contracts" ON public.recurring_contracts FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update recurring_contracts" ON public.recurring_contracts FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete recurring_contracts" ON public.recurring_contracts FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));

-- third_party_plans
DROP POLICY IF EXISTS "org members insert third_party_plans" ON public.third_party_plans;
DROP POLICY IF EXISTS "org members update third_party_plans" ON public.third_party_plans;
DROP POLICY IF EXISTS "org members delete third_party_plans" ON public.third_party_plans;
CREATE POLICY "org members insert third_party_plans" ON public.third_party_plans FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update third_party_plans" ON public.third_party_plans FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete third_party_plans" ON public.third_party_plans FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));

-- financial_transactions
DROP POLICY IF EXISTS "org members insert financial_transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "org members update financial_transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "org members delete financial_transactions" ON public.financial_transactions;
CREATE POLICY "org members insert financial_transactions" ON public.financial_transactions FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update financial_transactions" ON public.financial_transactions FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete financial_transactions" ON public.financial_transactions FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));

-- client_documents
DROP POLICY IF EXISTS "org members insert client_documents" ON public.client_documents;
DROP POLICY IF EXISTS "org members update client_documents" ON public.client_documents;
DROP POLICY IF EXISTS "org members delete client_documents" ON public.client_documents;
CREATE POLICY "org members insert client_documents" ON public.client_documents FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members update client_documents" ON public.client_documents FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));
CREATE POLICY "org members delete client_documents" ON public.client_documents FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND is_org_active(organization_id));