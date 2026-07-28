-- ===========================================================================
-- RUN THIS IN THE SQL EDITOR OF THE LIVE PROJECT: dyajmgddsiqcnlehqbhl
-- ===========================================================================
--
-- Why this file exists rather than just a migration: the repo's
-- supabase/migrations/ folder does NOT reproduce the live database (see
-- docs/integration-triage.md and the project notes). Two of the tables the
-- application code already depends on were never applied live. This file is
-- the exact set of objects the live project is missing, in dependency order,
-- and is safe to run more than once — every statement is create-if-not-exists
-- or create-or-replace.
--
-- Contents:
--   1. email_jobs                 EXISTING definition from
--                                 20260715180000_enterprise_hardening.sql that
--                                 never reached the live DB. lib/leads.ts falls
--                                 back to this queue whenever a lead
--                                 notification email fails — with the table
--                                 missing, enqueueEmailJob() catches the error
--                                 and returns false, so those leads' emails are
--                                 dropped silently. This is the highest-priority
--                                 statement in the file.
--   2. integration_runs           per-call structured log
--   3. integration_connections    per-connection health (the alerting surface)
--   4. integration_health         view adding derived staleness
--   5. prune_integration_runs()   90-day retention
--   6. seed rows                  staleness expectations
--
-- After running, reload the API schema cache (Supabase does this automatically
-- within a minute; to force it: Settings → API → Restart, or run
-- `notify pgrst, 'reload schema';`). Then verify:
--
--   curl -H "Authorization: Bearer $CRON_SECRET" \
--        https://<site>/api/health/integrations
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Outbound email retry queue  (missing live — silently dropping lead emails)
-- ---------------------------------------------------------------------------

create table if not exists public.email_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'contact_notification',
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts int not null default 0,
  max_attempts int not null default 5,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_jobs_pending_idx
  on public.email_jobs (next_attempt_at)
  where status = 'pending';

alter table public.email_jobs enable row level security;
revoke all on table public.email_jobs from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. Per-call structured log
--
-- One row per outbound provider call. High volume, append-only, pruned on a
-- retention window. This is what you cluster and slice during a triage.
--
-- tenant_id is ON DELETE SET NULL so a client deletion de-identifies their call
-- history rather than orphaning it. No request or response bodies are stored —
-- lib/integration-log.ts redacts structurally at the logger, and error_message
-- holds our classified summary, never a raw provider payload.
-- ---------------------------------------------------------------------------

create table if not exists public.integration_runs (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  correlation_id text not null,
  provider text not null,
  connection_id text not null default 'default',
  tenant_id uuid references public.clients(id) on delete set null,
  operation text not null,
  attempt integer not null default 1,
  status_code integer,
  duration_ms integer not null default 0,
  -- OUR taxonomy, not the provider's string. Provider strings change without
  -- notice and differ per endpoint, which makes them useless for grouping.
  error_class text check (
    error_class is null or error_class in (
      'rate_limited','auth_expired','auth_revoked','permission_denied',
      'validation','not_found','provider_unavailable','timeout','our_bug'
    )
  ),
  error_message text,
  provider_request_id text,
  outcome text not null check (
    outcome in ('success','retrying','failed','dead_lettered','skipped')
  )
);

-- "Is this provider broken, and when did it start" — the onset query.
create index if not exists integration_runs_provider_ts_idx
  on public.integration_runs (provider, ts desc);
-- "Is it just this customer."
create index if not exists integration_runs_tenant_ts_idx
  on public.integration_runs (tenant_id, ts desc) where tenant_id is not null;
-- "Is it just this connection."
create index if not exists integration_runs_connection_ts_idx
  on public.integration_runs (provider, connection_id, ts desc);
-- "Every hop of this one operation, retries included."
create index if not exists integration_runs_correlation_idx
  on public.integration_runs (correlation_id);
-- Failure clustering reads only failures.
create index if not exists integration_runs_failures_idx
  on public.integration_runs (provider, error_class, ts desc)
  where outcome in ('failed','dead_lettered','retrying');

alter table public.integration_runs enable row level security;
revoke all on table public.integration_runs from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. Per-connection health — the alerting surface
--
-- Tiny and mutable. Alerting reads THIS, per row, and never averages across
-- rows: one connection failing 100% hides inside a healthy aggregate and never
-- crosses an alert line.
-- ---------------------------------------------------------------------------

create table if not exists public.integration_connections (
  provider text not null,
  connection_id text not null default 'default',
  tenant_id uuid references public.clients(id) on delete cascade,
  -- The single most valuable integration metric: a connection that stopped
  -- working generates no errors and no logs, only this timestamp going stale.
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_attempt_at timestamptz,
  consecutive_failures integer not null default 0,
  last_error_class text,
  last_error_message text,
  -- Expected cadence in seconds; staleness fires at 2x. Null = on demand,
  -- because a connection nobody has called is not a broken connection.
  expected_interval_seconds integer,
  status text not null default 'unknown' check (
    status in ('healthy','degraded','needs_reauth','down','unknown')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, connection_id)
);

create index if not exists integration_connections_status_idx
  on public.integration_connections (status) where status <> 'healthy';
create index if not exists integration_connections_tenant_idx
  on public.integration_connections (tenant_id) where tenant_id is not null;

alter table public.integration_connections enable row level security;
revoke all on table public.integration_connections from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4. Health view
-- ---------------------------------------------------------------------------

create or replace view public.integration_health
with (security_invoker = true) as
select
  c.provider,
  c.connection_id,
  c.tenant_id,
  c.status,
  c.last_success_at,
  c.last_failure_at,
  c.last_attempt_at,
  c.consecutive_failures,
  c.last_error_class,
  c.last_error_message,
  c.expected_interval_seconds,
  extract(epoch from (now() - c.last_success_at))::bigint as seconds_since_success,
  case
    when c.expected_interval_seconds is null then false
    when c.last_success_at is null then true
    else now() - c.last_success_at > make_interval(secs => c.expected_interval_seconds * 2)
  end as is_stale
from public.integration_connections c;

revoke all on public.integration_health from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 5. Retention — 90 days covers "when did this start" for slow-burn failures
-- ---------------------------------------------------------------------------

create or replace function public.prune_integration_runs(retain_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.integration_runs
  where ts < now() - make_interval(days => retain_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.prune_integration_runs(integer) from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 6. Seed: staleness expectations
--
-- Only connections with a REAL expected cadence get an interval. Guessing one
-- for an on-demand connection manufactures false alarms, and an alert people
-- learn to ignore is worse than no alert.
--
--   internal/cron.scheduling  fires every 5 minutes (vercel.json). If it stops,
--                             the email queue stops draining, reminders stop
--                             sending, and lifecycle jobs stop running — all
--                             silently. Highest-value staleness alert here.
--   resend/stripe/anthropic   on demand. A quiet day is not an outage; their
--                             failures are caught by consecutive_failures.
-- ---------------------------------------------------------------------------

insert into public.integration_connections
  (provider, connection_id, expected_interval_seconds, status)
values
  ('internal', 'cron.scheduling', 300, 'unknown'),
  ('resend',   'default',         null, 'unknown'),
  ('stripe',   'default',         null, 'unknown'),
  ('stripe',   'webhook',         null, 'unknown'),
  ('anthropic','default',         null, 'unknown')
on conflict (provider, connection_id) do nothing;


-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';

select 'email_jobs' as object, count(*)::text as rows from public.email_jobs
union all
select 'integration_connections', count(*)::text from public.integration_connections
union all
select 'integration_health (view)', count(*)::text from public.integration_health;
