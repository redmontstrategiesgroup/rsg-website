-- ---------------------------------------------------------------------------
-- Observatory — scenario persistence (July 2026)
--
-- First backend slice of mounting the Observatory decision-analysis app as a
-- tenant-scoped product. Replaces the app's single-browser localStorage store
-- (obs_store_v1) with per-client rows. A scenario spec is a rich nested object
-- (branches / deltas / param overrides / assumptions) — stored as jsonb; the
-- name/status/spec_id are lifted out for listing and upsert.
--
-- Service-role only: RLS enabled, anon/authenticated revoked. Access is via the
-- service-role client scoped by client_id in lib/observatory/store.
-- ---------------------------------------------------------------------------

create table if not exists public.obs_scenarios (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  spec_id text not null,                 -- the app's own spec id (unique per client)
  name text not null,
  status text not null default 'draft',
  spec jsonb not null,                   -- full ScenarioSpec (see lib/observatory/types)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, spec_id)
);

create index if not exists obs_scenarios_client_updated_idx
  on public.obs_scenarios (client_id, updated_at desc);

alter table public.obs_scenarios enable row level security;
revoke all on table public.obs_scenarios from anon, authenticated;
