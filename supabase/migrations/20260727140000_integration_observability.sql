-- ---------------------------------------------------------------------------
-- Integration observability (July 2026)
--
-- Two tables, deliberately split by how they are queried:
--
--   integration_runs        one row per outbound provider call. High volume,
--                           append-only, pruned on a retention window. This is
--                           what you cluster and slice during a triage.
--
--   integration_connections one row per (provider, connection). Tiny, mutable,
--                           holds last_success_at / consecutive_failures /
--                           status. This is what you ALERT from — a query
--                           against a handful of rows, not a scan of millions.
--
-- The split matters. Aggregate failure rates hide a single connection failing
-- 100%, so alerting reads integration_connections per row and never averages
-- across them.
--
-- "Connection" here means a distinct credential/account against a provider —
-- the Resend sending domain, the Stripe account, the Anthropic key. Today RSG
-- runs one connection per provider, so connection_id defaults to 'default';
-- the column exists so per-client credentials (a client's own Stripe account,
-- their own calendar) slot in without a schema change.
--
-- Privacy: tenant_id is a FK with ON DELETE SET NULL, so a client deletion
-- de-identifies their call history rather than orphaning it. No request or
-- response bodies are stored here — see lib/integration-log.ts, which redacts
-- structurally at the logger. error_message holds OUR classified summary,
-- truncated, never a raw provider payload.
--
-- Service-role only, matching every other operational table here.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Per-call structured log
-- ---------------------------------------------------------------------------

create table if not exists public.integration_runs (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),

  -- Ties one logical operation across services, retries, and background jobs.
  correlation_id text not null,

  -- The three axes every triage slices on.
  provider text not null,
  connection_id text not null default 'default',
  tenant_id uuid references public.clients(id) on delete set null,

  operation text not null,          -- 'email.send', not "sending email"
  attempt integer not null default 1,
  status_code integer,              -- provider HTTP status when there was one
  duration_ms integer not null default 0,

  -- OUR taxonomy, not the provider's string. Provider strings change without
  -- notice and differ per endpoint, which makes them useless for grouping.
  error_class text check (
    error_class is null or error_class in (
      'rate_limited',
      'auth_expired',
      'auth_revoked',
      'permission_denied',
      'validation',
      'not_found',
      'provider_unavailable',
      'timeout',
      'our_bug'
    )
  ),
  error_message text,               -- redacted + truncated, for humans

  -- What the provider's support team will ask for first.
  provider_request_id text,

  outcome text not null check (
    outcome in ('success', 'retrying', 'failed', 'dead_lettered', 'skipped')
  )
);

-- "Is this provider broken, and when did it start" — the onset query.
create index if not exists integration_runs_provider_ts_idx
  on public.integration_runs (provider, ts desc);

-- "Is it just this customer" — per-tenant slice.
create index if not exists integration_runs_tenant_ts_idx
  on public.integration_runs (tenant_id, ts desc)
  where tenant_id is not null;

-- "Is it just this connection" — per-connection slice.
create index if not exists integration_runs_connection_ts_idx
  on public.integration_runs (provider, connection_id, ts desc);

-- "Show me every hop of this one operation, including its retries."
create index if not exists integration_runs_correlation_idx
  on public.integration_runs (correlation_id);

-- Failure clustering reads only failures; a partial index keeps it cheap even
-- when the table is dominated by successes.
create index if not exists integration_runs_failures_idx
  on public.integration_runs (provider, error_class, ts desc)
  where outcome in ('failed', 'dead_lettered', 'retrying');

alter table public.integration_runs enable row level security;
revoke all on table public.integration_runs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Per-connection health — the alerting surface
-- ---------------------------------------------------------------------------

create table if not exists public.integration_connections (
  provider text not null,
  connection_id text not null default 'default',
  tenant_id uuid references public.clients(id) on delete cascade,

  -- The single most valuable integration metric. A connection that stopped
  -- working three weeks ago generates no errors and no logs — only this
  -- timestamp going stale.
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_attempt_at timestamptz,

  consecutive_failures integer not null default 0,
  last_error_class text,
  last_error_message text,          -- in OUR words; safe to show an admin

  -- How often this connection is EXPECTED to be exercised, in seconds. Staleness
  -- alerts fire at 2x this. Null means "on demand" — no staleness expectation,
  -- because a connection nobody has called is not a broken connection.
  expected_interval_seconds integer,

  status text not null default 'unknown' check (
    status in ('healthy', 'degraded', 'needs_reauth', 'down', 'unknown')
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (provider, connection_id)
);

create index if not exists integration_connections_status_idx
  on public.integration_connections (status)
  where status <> 'healthy';

create index if not exists integration_connections_tenant_idx
  on public.integration_connections (tenant_id)
  where tenant_id is not null;

alter table public.integration_connections enable row level security;
revoke all on table public.integration_connections from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Health view — adds the derived staleness the alert query reads
-- ---------------------------------------------------------------------------

-- security_invoker: the view runs with the caller's rights rather than the
-- owner's, so it cannot become a way around the RLS on the table beneath it.
-- (Only the service-role client reads it, which bypasses RLS regardless — this
-- keeps the Supabase security advisor quiet and the intent explicit.)
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
  extract(epoch from (now() - c.last_success_at))::bigint
    as seconds_since_success,
  -- Stale = we expected this to run by now and the last RUN THAT SUCCEEDED is
  -- older than two intervals. Connections with no expectation are never stale.
  case
    when c.expected_interval_seconds is null then false
    when c.last_success_at is null then true
    else now() - c.last_success_at
         > make_interval(secs => c.expected_interval_seconds * 2)
  end as is_stale
from public.integration_connections c;

revoke all on public.integration_health from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retention
--
-- 90 days of call logs covers "when did this start" for slow-burn failures
-- without the table growing without bound. integration_connections is never
-- pruned — it is one row per connection and answers audit questions.
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
-- Seed: staleness expectations
--
-- Only connections with a REAL expected cadence get an interval. Guessing one
-- for an on-demand connection manufactures false alarms, and an alert people
-- learn to ignore is worse than no alert.
--
--   internal/cron.scheduling  fires every 5 minutes (vercel.json). If it stops,
--                             the email queue stops draining, reminders stop
--                             sending, and lifecycle jobs stop running — all
--                             silently. This is the highest-value staleness
--                             alert in the system.
--
--   resend, stripe, anthropic on demand. A day with no emails, no billing
--                             events, and no AI calls is a quiet Sunday, not
--                             an outage. Their failures are caught by
--                             consecutive_failures and status instead.
--
-- Set an interval later with lib/integration-log.setExpectedInterval() once a
-- connection has an observed cadence worth holding it to.
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
