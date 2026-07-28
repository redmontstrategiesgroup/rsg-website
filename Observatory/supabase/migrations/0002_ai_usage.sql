-- ============================================================================
-- AI usage metering + spend cap — IDENTICAL in every app project.
--
-- Canonical copy: shared/supabase/0002_ai_usage.sql
-- Vendored to:    <app>/supabase/migrations/0002_ai_usage.sql (do not edit there)
--
-- Ported from `basic website/lib/ai/usage` + its ai_usage migration. Metering
-- lives in the SAME database as the app so the cap can be enforced without a
-- network hop — a cap that needs a call to another project fails open exactly
-- when that project is down. Totals roll up to the website nightly for
-- invoicing (docs/per-app-supabase.md §3.3).
-- ============================================================================

create table if not exists public.ai_usage (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.app_users (id) on delete cascade,
  client_id      uuid,          -- denormalised at write time for the billing rollup;
                                -- null for self-serve users with no client link
  app            text not null, -- ghost | nexus | observatory | forge | onehand
  model          text not null,
  input_tokens   integer not null default 0,
  output_tokens  integer not null default 0,
  cost_usd       numeric(12, 6) not null default 0,
  ok             boolean not null default true,  -- false = call failed; still metered
                                                 -- if tokens were billed upstream
  created_at     timestamptz not null default now()
);

create index if not exists ai_usage_user_month_idx
  on public.ai_usage (user_id, created_at desc);
create index if not exists ai_usage_client_month_idx
  on public.ai_usage (client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- ai_caps — monthly spend ceiling. Per user; a null row means the default.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_caps (
  user_id           uuid primary key references public.app_users (id) on delete cascade,
  monthly_limit_usd numeric(12, 2) not null default 5.00,
  updated_at        timestamptz not null default now()
);

-- Default ceiling for users with no explicit cap row. Deliberately low: an
-- unmetered key is how a demo turns into a four-figure bill.
create or replace function public.ai_default_cap_usd()
returns numeric
language sql
immutable
as $$ select 5.00::numeric $$;

-- ---------------------------------------------------------------------------
-- ai_spend_mtd(uuid) — month-to-date spend, UTC calendar month.
-- ---------------------------------------------------------------------------
create or replace function public.ai_spend_mtd(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(cost_usd), 0)
  from public.ai_usage
  where user_id = p_user
    and created_at >= date_trunc('month', now() at time zone 'utc');
$$;

-- ---------------------------------------------------------------------------
-- ai_cap_remaining(uuid) — what the caller has left this month. The `ai` edge
-- function calls this BEFORE dispatching to Anthropic and refuses at <= 0.
-- ---------------------------------------------------------------------------
create or replace function public.ai_cap_remaining(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
           (select monthly_limit_usd from public.ai_caps where user_id = p_user),
           public.ai_default_cap_usd()
         ) - public.ai_spend_mtd(p_user);
$$;

-- ---------------------------------------------------------------------------
-- Who may call the two functions above.
--
-- They are SECURITY DEFINER and take the user as a PARAMETER, so they read
-- straight past the RLS policies below. Granting them to `authenticated` let
-- any signed-in user pass somebody else's uuid and read that person's exact
-- month-to-date spend and remaining cap — verified against Postgres 17: user B
-- called ai_spend_mtd(A) and got back A's $4.25. The policy on ai_usage was
-- correct and entirely bypassed.
--
-- So: the parameterised forms are service-role only (the `ai` edge function is
-- the caller, and it already knows whose request it is holding), and the
-- browser gets no-argument wrappers that can only ever describe the caller.
-- ---------------------------------------------------------------------------
revoke all on function public.ai_spend_mtd(uuid)     from public, anon, authenticated;
revoke all on function public.ai_cap_remaining(uuid) from public, anon, authenticated;
grant execute on function public.ai_spend_mtd(uuid)     to service_role;
grant execute on function public.ai_cap_remaining(uuid) to service_role;

create or replace function public.ai_my_spend_mtd()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$ select public.ai_spend_mtd(auth.uid()) $$;

create or replace function public.ai_my_cap_remaining()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$ select public.ai_cap_remaining(auth.uid()) $$;

revoke all on function public.ai_my_spend_mtd()     from public, anon;
revoke all on function public.ai_my_cap_remaining() from public, anon;
grant execute on function public.ai_my_spend_mtd()     to authenticated;
grant execute on function public.ai_my_cap_remaining() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — a user may read their own usage and their own cap. Nobody writes
-- either from the browser: usage is written by the `ai` edge function
-- (service role) and caps are set by an operator.
-- ---------------------------------------------------------------------------
alter table public.ai_usage enable row level security;
alter table public.ai_caps  enable row level security;

drop policy if exists ai_usage_read_own on public.ai_usage;
create policy ai_usage_read_own on public.ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists ai_caps_read_own on public.ai_caps;
create policy ai_caps_read_own on public.ai_caps
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.ai_usage from anon;
revoke all on table public.ai_caps  from anon;
