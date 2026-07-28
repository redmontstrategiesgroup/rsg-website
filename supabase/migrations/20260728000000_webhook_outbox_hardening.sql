-- ============================================================================
-- Webhook outbox hardening (July 2026)
--
-- The original deliverer (lib/scheduling/webhooks.ts, from the scheduling
-- platform migration) had four structural faults this migration exists to fix:
--
--   1. NO CLAIM. Two concurrent deliverPendingWebhooks() runs selected the same
--      `pending` rows and both POSTed them. Duplicate delivery was guaranteed by
--      construction, not by an unlucky race. Fixed by claim_webhook_deliveries()
--      below, which uses FOR UPDATE SKIP LOCKED.
--
--   2. NO BACKOFF. A failure flipped straight back to `pending` and was retried
--      on the very next cron tick. All attempts burned within minutes, so a
--      brief endpoint outage permanently failed the event. Fixed by
--      next_attempt_at, which the claim query respects.
--
--   3. NO DEAD LETTER. `failed` was terminal with no replay path — after fixing
--      a broken endpoint there was no way to re-drive what it missed. Fixed by
--      the `dead` status + dead_lettered_at, and replayDeadLetters() in code.
--
--   4. NO ORDERING SIGNAL. A receiver could not tell that two events for the
--      same entity arrived out of order. Fixed by a per-endpoint monotonic
--      `sequence`, allocated by next_endpoint_sequence().
--
-- Both webhook_endpoints and webhook_deliveries are EMPTY in the live database
-- (verified 2026-07-27), so there is no live subscriber to break. That is what
-- makes it safe to tighten the status constraint and change the signing scheme
-- in the same change — see lib/webhooks/sign.ts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- webhook_endpoints
-- ---------------------------------------------------------------------------

-- `kind` separates ordinary subscriber endpoints from the per-app registry-sync
-- destinations added by the per-app Supabase split (docs/per-app-supabase.md).
-- Both are "a URL plus a shared secret", so they share this table and the whole
-- delivery pipeline rather than growing a second bespoke sender.
alter table public.webhook_endpoints
  add column if not exists kind text not null default 'client',
  add column if not exists description text,
  -- Per-endpoint monotonic counter. Lives on the endpoint so allocation is a
  -- single atomic UPDATE ... RETURNING; a global sequence would not let a
  -- receiver detect a gap in ITS OWN stream.
  add column if not exists seq bigint not null default 0;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'webhook_endpoints_kind_check'
  ) then
    alter table public.webhook_endpoints
      add constraint webhook_endpoints_kind_check check (kind in ('client', 'registry'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- webhook_deliveries
-- ---------------------------------------------------------------------------
alter table public.webhook_deliveries
  -- Stable, event-derived identity. The old idempotency_key was
  -- `${eventType}:${createSecureToken(12)}` — random per delivery, so a
  -- receiver could not dedupe a genuine duplicate and the Idempotency-Key
  -- header was decorative. event_id is derived from the domain entity.
  add column if not exists event_id text,
  add column if not exists sequence bigint,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by text,
  add column if not exists dead_lettered_at timestamptz,
  add column if not exists max_attempts integer not null default 8,
  add column if not exists correlation_id text;

-- Widen the status set: 'sending' (claimed, in flight) and 'dead' (exhausted,
-- awaiting replay) did not exist before.
alter table public.webhook_deliveries
  drop constraint if exists webhook_deliveries_status_check;
alter table public.webhook_deliveries
  add constraint webhook_deliveries_status_check check (status in (
    'pending', 'sending', 'delivered', 'failed', 'dead'
  ));

-- Enqueue-time dedupe: the same domain event can only be queued once per
-- endpoint. This is what makes a double-fired enqueueWebhook harmless.
create unique index if not exists webhook_deliveries_event_uniq
  on public.webhook_deliveries (endpoint_id, event_id)
  where event_id is not null;

-- Drives the claim query.
create index if not exists webhook_deliveries_claimable_idx
  on public.webhook_deliveries (status, next_attempt_at)
  where status in ('pending', 'sending');

create index if not exists webhook_deliveries_dead_idx
  on public.webhook_deliveries (dead_lettered_at desc)
  where status = 'dead';

-- Any pre-existing row is due immediately (both tables are empty; correctness
-- if that ever stops being true).
update public.webhook_deliveries
   set next_attempt_at = coalesce(next_attempt_at, created_at, now())
 where next_attempt_at is null;

-- ---------------------------------------------------------------------------
-- next_endpoint_sequence — allocate the next per-endpoint sequence number.
--
-- A single atomic UPDATE ... RETURNING. Two concurrent enqueues cannot receive
-- the same number: the second blocks on the row lock until the first commits.
-- ---------------------------------------------------------------------------
create or replace function public.next_endpoint_sequence(p_endpoint uuid)
returns bigint
language sql
volatile
security definer
set search_path = ''
as $$
  update public.webhook_endpoints
     set seq = seq + 1
   where id = p_endpoint
  returning seq;
$$;

-- ---------------------------------------------------------------------------
-- claim_webhook_deliveries — atomically take ownership of a batch.
--
-- FOR UPDATE SKIP LOCKED is the whole point: concurrent workers step over rows
-- another worker has locked instead of blocking on them or, as before, happily
-- selecting and re-sending them. Marking the rows 'sending' inside the same
-- statement means a row is never visible as claimable twice.
--
-- Ordered by (endpoint_id, sequence) so a given endpoint's events are attempted
-- in the order they were produced. Ordering across endpoints does not matter and
-- is not promised.
-- ---------------------------------------------------------------------------
create or replace function public.claim_webhook_deliveries(
  p_limit  integer,
  p_worker text
)
returns table (
  id              uuid,
  endpoint_id     uuid,
  event_type      text,
  event_id        text,
  sequence        bigint,
  payload         jsonb,
  attempts        integer,
  max_attempts    integer,
  idempotency_key text,
  correlation_id  text,
  url             text,
  secret          text,
  kind            text
)
language sql
volatile
security definer
set search_path = ''
as $$
  with claimed as (
    select d.id
      from public.webhook_deliveries d
      join public.webhook_endpoints e on e.id = d.endpoint_id
     where d.status = 'pending'
       and d.next_attempt_at <= now()
       and e.enabled
     order by d.endpoint_id, d.sequence nulls last, d.created_at
     limit p_limit
       for update of d skip locked
  ),
  taken as (
    update public.webhook_deliveries d
       set status     = 'sending',
           claimed_at = now(),
           claimed_by = p_worker
      from claimed c
     where d.id = c.id
    returning d.*
  )
  select t.id, t.endpoint_id, t.event_type, t.event_id, t.sequence, t.payload,
         t.attempts, t.max_attempts, t.idempotency_key, t.correlation_id,
         e.url, e.secret, e.kind
    from taken t
    join public.webhook_endpoints e on e.id = t.endpoint_id;
$$;

-- ---------------------------------------------------------------------------
-- release_stale_webhook_claims — recover rows orphaned by a dead worker.
--
-- A serverless function that is killed mid-delivery leaves its row in 'sending'
-- forever, and nothing else will ever claim it. Without this, a single timeout
-- silently drops an event permanently.
--
-- The attempt IS counted on release: the request may well have reached the
-- endpoint before the worker died, so treating it as a free retry is how a
-- receiver ends up processing it many times over.
-- ---------------------------------------------------------------------------
create or replace function public.release_stale_webhook_claims(
  p_timeout interval default interval '5 minutes'
)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with released as (
    update public.webhook_deliveries
       set status          = case
                               when attempts + 1 >= max_attempts then 'dead'
                               else 'pending'
                             end,
           attempts        = attempts + 1,
           dead_lettered_at = case
                                when attempts + 1 >= max_attempts then now()
                                else dead_lettered_at
                              end,
           last_error      = 'worker vanished mid-delivery (claim expired)',
           claimed_at      = null,
           claimed_by      = null,
           next_attempt_at = now() + interval '1 minute'
     where status = 'sending'
       and claimed_at < now() - p_timeout
    returning 1
  )
  select coalesce(count(*), 0)::integer from released;
$$;

revoke all on function public.next_endpoint_sequence(uuid)          from public, anon, authenticated;
revoke all on function public.claim_webhook_deliveries(integer, text) from public, anon, authenticated;
revoke all on function public.release_stale_webhook_claims(interval)  from public, anon, authenticated;

comment on function public.claim_webhook_deliveries(integer, text) is
  'Atomically claim a batch of due deliveries. FOR UPDATE SKIP LOCKED prevents '
  'two concurrent workers from sending the same event — the defect this '
  'replaced. Service role only.';
