CREATE TABLE public.platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

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