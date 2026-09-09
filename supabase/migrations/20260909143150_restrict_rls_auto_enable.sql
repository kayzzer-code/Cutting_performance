-- Supabase creates this SECURITY DEFINER helper when automatic RLS is enabled.
-- It is an administrative trigger helper and must not be callable through the
-- public Data API by anonymous or application users.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
