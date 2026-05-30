
-- Trigger-only functions: ninguém deve chamar via API
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_expense_occurrence_on_tx() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unlink_tx_on_occurrence_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_provider_payable_on_tx() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unlink_tx_on_provider_payable_delete() FROM PUBLIC, anon, authenticated;

-- Admin utility (executado apenas via SQL editor pelo super_admin)
REVOKE EXECUTE ON FUNCTION public.link_super_admin_by_email(text) FROM PUBLIC, anon, authenticated;

-- Helpers de RLS: garantir que só authenticated pode chamar (anon não precisa)
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_active(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, public.org_role[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, public.org_role[]) TO authenticated;
