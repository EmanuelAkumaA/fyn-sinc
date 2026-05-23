CREATE POLICY "super_admin inserts global roles" ON public.user_global_roles
  FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "super_admin updates global roles" ON public.user_global_roles
  FOR UPDATE TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "super_admin deletes global roles" ON public.user_global_roles
  FOR DELETE TO authenticated USING (is_super_admin(auth.uid()));