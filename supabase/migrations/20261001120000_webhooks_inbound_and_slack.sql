-- Replay guard for inbound provider webhooks (Cal.com today).
--
-- Providers deliver at least once. A handler with side effects that are not
-- naturally idempotent (creating a lead, notifying the owner) claims
-- (provider, event_id) first; the primary key makes the second claim fail
-- with 23505, which the handler treats as "already processed".

create table if not exists public.inbound_webhook_events (
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);

-- Server-only table: the service role bypasses RLS; nobody else may read it.
alter table public.inbound_webhook_events enable row level security;

create index if not exists inbound_webhook_events_received_idx
  on public.inbound_webhook_events (received_at);

-- Slack incoming webhooks are a third outbox destination class alongside
-- subscriber ('client') and registry-sync ('registry') endpoints. The outbox
-- formats their payload as a Slack message instead of a signed RSG envelope.
alter table public.webhook_endpoints drop constraint if exists webhook_endpoints_kind_check;
alter table public.webhook_endpoints
  add constraint webhook_endpoints_kind_check check (kind in ('client', 'registry', 'slack'));
