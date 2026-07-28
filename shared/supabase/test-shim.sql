-- Minimal Supabase shim so the app migrations can be applied to a stock
-- Postgres for validation. Provides only what the migrations reference.
-- NOT part of any app's migration set — validation only.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon')
    then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated')
    then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')
    then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Real Supabase reads the sub claim from the request JWT. Here it comes from a
-- session GUC the test sets, which is enough to exercise the policies.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to anon, authenticated, service_role;

-- Hosted Supabase grants anon/authenticated table privileges by default, and RLS
-- is what narrows them back down. A stock Postgres does not, so without this the
-- isolation test would fail with "permission denied" — passing for the wrong
-- reason and telling us nothing about the policies. Set BEFORE the migrations
-- run so it applies to the tables they create; the explicit REVOKEs inside those
-- migrations then take effect on top, exactly as they do in production.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
