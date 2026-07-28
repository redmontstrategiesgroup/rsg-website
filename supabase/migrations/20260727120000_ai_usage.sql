-- ---------------------------------------------------------------------------
-- Per-tenant AI usage metering (July 2026)
--
-- Records every server-side Anthropic call made through lib/ai/proxy by a
-- mounted app (Observatory, Forge, NEXUS, ...) so AI spend is ATTRIBUTED and
-- CAPPED per client — closing the old "uncapped, unattributed, browser-side
-- key" gap. Written by lib/ai/usage.recordAiUsage via the proxy's onUsage hook.
--
-- Service-role only: RLS enabled, anon/authenticated revoked. All access goes
-- through the service-role client, scoped by client_id in application code
-- (lib/ai/usage) — the same pattern as every other tenant-owned table here.
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

create index if not exists ai_usage_client_period_idx on public.ai_usage (client_id, period);
create index if not exists ai_usage_client_created_idx on public.ai_usage (client_id, created_at);

alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;
