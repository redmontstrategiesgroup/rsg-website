-- ===========================================================================
-- RUN THIS IN THE SQL EDITOR OF THE LIVE PROJECT: dyajmgddsiqcnlehqbhl
-- ===========================================================================
--
-- Two tables the application code already depends on that were never applied
-- to the live database. Both are copied verbatim from migrations that exist in
-- supabase/migrations/ — this file changes nothing about them, it just gets
-- them onto the live project. See docs/audit-2026-07-28.md (H1, H2).
--
-- Safe to run more than once: every statement is create-if-not-exists.
-- Depends on public.clients existing (it does).
--
--   ai_usage      from 20260727120000_ai_usage.sql
--   audit_events  from 20260715180000_enterprise_hardening.sql
--
-- Apply this alongside APPLY-integration-observability.sql, which carries the
-- third missing table (email_jobs) plus the observability schema.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. ai_usage — per-tenant AI metering
--
-- WHY IT MATTERS RIGHT NOW: lib/ai/usage.isTenantOverAiCap() fails OPEN when
-- usage cannot be read. With this table absent that is a permanent condition,
-- so MONTHLY_TOKEN_CAP (default 5,000,000 tokens/tenant/month) can NEVER
-- trigger, and recordAiUsage() silently discards every row — there is no spend
-- attribution at all. Failing open is the right behavior for a transient
-- metering outage, which is what it was written for; it is the wrong behavior
-- for a table that does not exist.
--
-- Service-role only: RLS enabled, anon/authenticated revoked. All access goes
-- through the service-role client, scoped by client_id in application code.
-- ---------------------------------------------------------------------------

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  app text not null,                       -- which mounted app made the call
  model text not null,                     -- Anthropic model id
  input_tokens integer not null default 0, -- exact, from the API response
  output_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0, -- ESTIMATE (tokens × approx rate)
  period text not null,                    -- 'YYYY-MM-01' UTC bucket for monthly rollups
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_client_period_idx
  on public.ai_usage (client_id, period);
create index if not exists ai_usage_client_created_idx
  on public.ai_usage (client_id, created_at);

alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. audit_events — unified audit log
--
-- WHY IT MATTERS RIGHT NOW: lib/audit.writeAuditEvent() catches its insert
-- failure and console.warns, so with this table absent EVERY admin action,
-- auth event, and cron run writes nothing. listAuditEvents() then returns []
-- and the admin UI renders an empty audit log that is indistinguishable from
-- "no activity has occurred" — the failure mode is not a missing feature, it
-- is a feature that looks present and reports nothing.
-- ---------------------------------------------------------------------------

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('admin', 'system', 'cron', 'anonymous')),
  actor_id text,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_created_at_idx
  on public.audit_events (created_at desc);
create index if not exists audit_events_action_idx
  on public.audit_events (action);
create index if not exists audit_events_actor_email_idx
  on public.audit_events (actor_email);

alter table public.audit_events enable row level security;
revoke all on table public.audit_events from anon, authenticated;


-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';

select 'ai_usage' as object, count(*)::text as rows from public.ai_usage
union all
select 'audit_events', count(*)::text from public.audit_events;
