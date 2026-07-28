-- ============================================================================
-- Observatory — domain schema
--
-- Ports the `obs_store_v1` localStorage blob (Observatory/js/core.js) to
-- Postgres: scenarios, reports, audit, calibrations, imports, settings and
-- paramOverrides.
--
-- Two things change on the way across, both deliberate:
--
-- 1. The save() fallback in core.js trims to the last 5 reports and 200 audit
--    rows when the 5MB browser quota is hit. That trim is gone — it existed
--    only because of localStorage, and quietly dropping a user's reports is a
--    data-loss bug that a real database has no reason to inherit.
--
-- 2. `settings.role` (viewer < analyst < admin) was a CLIENT-SIDE gate, which
--    the README lists under LIMITATIONS: the browser could simply set itself
--    to admin. Role now lives in app_users.role, which the browser cannot
--    write, and is enforced by RLS below. obs_settings keeps only preferences.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Scenarios — the modelled situation. Deterministic: the seed is part of the
-- record, so a scenario re-runs to identical output (core.js Rng contract).
-- ---------------------------------------------------------------------------
create table if not exists public.obs_scenarios (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users (id) on delete cascade,
  name        text not null default '',
  slug        text,
  seed        integer not null default 1,
  params      jsonb not null default '{}'::jsonb,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists obs_scenarios_user_idx on public.obs_scenarios (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Reports — an executed run of a scenario. `series` is the heavy column; keep
-- it separate from the scenario so re-running never rewrites the definition.
-- ---------------------------------------------------------------------------
create table if not exists public.obs_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.app_users (id) on delete cascade,
  scenario_id  uuid references public.obs_scenarios (id) on delete set null,
  title        text not null default '',
  engine       text not null default 'obs-engine-1',
  seed         integer,
  summary      jsonb not null default '{}'::jsonb,   -- headline stats
  series       jsonb not null default '{}'::jsonb,   -- per-day bands / paths
  created_at   timestamptz not null default now()
);
create index if not exists obs_reports_user_idx     on public.obs_reports (user_id, created_at desc);
create index if not exists obs_reports_scenario_idx on public.obs_reports (scenario_id);

-- ---------------------------------------------------------------------------
-- Calibrations — model-vs-actual, the record that keeps forecasts honest.
-- ---------------------------------------------------------------------------
create table if not exists public.obs_calibrations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.app_users (id) on delete cascade,
  scenario_id  uuid references public.obs_scenarios (id) on delete set null,
  mape         numeric(8, 3),                        -- null = not computable, not zero
  actuals      jsonb not null default '{}'::jsonb,
  predicted    jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists obs_calibrations_user_idx on public.obs_calibrations (user_id, created_at desc);

create table if not exists public.obs_imports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.app_users (id) on delete cascade,
  source       text not null default '',
  row_count    integer not null default 0,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists obs_imports_user_idx on public.obs_imports (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Settings + parameter overrides. Note the absence of `role`.
-- ---------------------------------------------------------------------------
create table if not exists public.obs_settings (
  user_id         uuid primary key references public.app_users (id) on delete cascade,
  theme           text not null default 'light',
  seeds           integer not null default 7,
  copilot_model   text not null default 'claude-opus-4-8',
  param_overrides jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- obs_audit — append-only (insert + select policies only).
-- ---------------------------------------------------------------------------
create table if not exists public.obs_audit (
  id          bigserial primary key,
  user_id     uuid not null references public.app_users (id) on delete cascade,
  action      text not null,
  detail      text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists obs_audit_user_idx on public.obs_audit (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Role, for real this time.
--
-- viewer < analyst < admin, read from app_users.role — a table the browser has
-- no write policy on. This is the server-side half that OBS.can() never had.
-- ---------------------------------------------------------------------------
create or replace function public.obs_role_rank(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case coalesce((select role from public.app_users where id = p_user), 'member')
           when 'admin'   then 2
           when 'analyst' then 1
           when 'member'  then 1   -- default signup can model; it cannot administer
           else 0                  -- 'viewer' and anything unrecognised: read-only
         end;
$$;

revoke all on function public.obs_role_rank(uuid) from public;
grant execute on function public.obs_role_rank(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.obs_scenarios    enable row level security;
alter table public.obs_reports      enable row level security;
alter table public.obs_calibrations enable row level security;
alter table public.obs_imports      enable row level security;
alter table public.obs_settings     enable row level security;
alter table public.obs_audit        enable row level security;

-- Everyone who owns a row may read it. Writing requires analyst or above, so a
-- 'viewer' is genuinely read-only rather than read-only in the UI layer.
do $$
declare t text;
begin
  foreach t in array array[
    'obs_scenarios','obs_reports','obs_calibrations','obs_imports'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_read_own', t);
    execute format($f$
      create policy %I on public.%I
        for select to authenticated
        using (user_id = (select auth.uid()))
    $f$, t || '_read_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_write_own', t);
    execute format($f$
      create policy %I on public.%I
        for all to authenticated
        using (user_id = (select auth.uid()) and public.obs_role_rank((select auth.uid())) >= 1)
        with check (user_id = (select auth.uid()) and public.obs_role_rank((select auth.uid())) >= 1)
    $f$, t || '_write_own', t);

    execute format('revoke all on table public.%I from anon', t);
  end loop;
end $$;

-- Settings are preferences: any authenticated owner may set their own.
drop policy if exists obs_settings_own on public.obs_settings;
create policy obs_settings_own on public.obs_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists obs_audit_insert_own on public.obs_audit;
create policy obs_audit_insert_own on public.obs_audit
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists obs_audit_read_own on public.obs_audit;
create policy obs_audit_read_own on public.obs_audit
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.obs_settings from anon;
revoke all on table public.obs_audit    from anon;
