-- ---------------------------------------------------------------------------
-- Observatory — report persistence (July 2026)
--
-- Second backend slice: the generated decision reports (fully-rendered HTML +
-- reproducibility meta), per client. Mirrors js/report.js's report object
-- ({ reportId, specId, name, html, meta }). Same tenant-scoped pattern as
-- obs_scenarios — service-role only, RLS enabled, anon/authenticated revoked.
-- ---------------------------------------------------------------------------

create table if not exists public.obs_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  report_id text not null,               -- the app's own rp_ id
  spec_id text not null,                 -- scenario the report is for
  name text not null,
  html text not null,                    -- fully-rendered report HTML
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (client_id, report_id)
);

create index if not exists obs_reports_client_created_idx
  on public.obs_reports (client_id, created_at desc);

alter table public.obs_reports enable row level security;
revoke all on table public.obs_reports from anon, authenticated;
