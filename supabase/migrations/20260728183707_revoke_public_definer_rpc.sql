-- Close the last unauthenticated entry point into a SECURITY DEFINER function.
--
-- PostgREST exposes every EXECUTE-able public function at /rest/v1/rpc/<name>.
-- rsg_is_staff() and rsg_role() are SECURITY DEFINER, and anon could reach both
-- — the only two of the schema's sixteen definer functions still exposed. Both
-- scope to auth.uid(), so an anonymous caller learns nothing (false / 'none'),
-- but an anonymous caller should not be able to enter a definer body at all.
--
-- The grant to fix is PUBLIC, not anon. Postgres grants EXECUTE to PUBLIC on
-- every new function, and anon inherits it — so `revoke ... from anon` is a
-- no-op here (there is no direct grant to remove) and leaves access intact.
-- Revoke PUBLIC, then re-grant explicitly. This reproduces the ACL the already
-- hardened functions carry, e.g. rsg_book_appointment:
--   {postgres=X/postgres,service_role=X/postgres}
--
-- authenticated KEEPS execute, deliberately. Postgres evaluates RLS policy
-- expressions with the calling role's privileges, and all 68 policies that call
-- these functions are TO authenticated — revoking there would deny every tenant
-- read. No policy references anon, so anon loses nothing.

revoke execute on function public.rsg_is_staff() from public;
revoke execute on function public.rsg_role() from public;

grant execute on function public.rsg_is_staff() to authenticated, service_role;
grant execute on function public.rsg_role() to authenticated, service_role;
