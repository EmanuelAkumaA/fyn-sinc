DROP POLICY IF EXISTS "org members update org" ON public.organizations;

CREATE POLICY "org owners/managers update org"
ON public.organizations
FOR UPDATE
TO authenticated
USING (public.has_org_role(id, ARRAY['owner','manager']::org_role[]))
WITH CHECK (public.has_org_role(id, ARRAY['owner','manager']::org_role[]));