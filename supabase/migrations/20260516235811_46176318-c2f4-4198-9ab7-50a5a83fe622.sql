
-- handle_new_user: only used as trigger on auth.users, no one should call it via API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- current_org_id: used inside RLS policies for authenticated users only
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;

-- is_org_member: used inside RLS policies for authenticated users only
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
