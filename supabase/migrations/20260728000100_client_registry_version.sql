-- ============================================================================
-- Client registry versioning + tombstones (July 2026)
--
-- Prerequisites for the registry-sync sender (docs/per-app-supabase.md §2).
-- The per-app receivers order events by a monotonic `version` and refuse to
-- apply an older one, which requires this side to actually produce one.
--
-- Two gaps this closes:
--
--   1. NO VERSION. `clients` has `updated_at` but no counter. A timestamp is
--      the wrong ordering key across machines: two updates inside the same
--      millisecond tie, and any clock correction can move it backwards — at
--      which point the receiver silently rejects a real change as stale.
--
--   2. NO TOMBSTONE. Client deletion is a hard DELETE, so a deleted client
--      would simply stop being mentioned and the app mirrors would keep serving
--      it forever. Deletion has to be an event, not an absence.
-- ============================================================================

alter table public.clients
  add column if not exists registry_version bigint not null default 1;

-- A destination is identified by its URL. Needed so registerAppDestination()
-- can upsert idempotently — re-running the setup for an app must update that
-- app's endpoint, not add a second one that then gets every event twice.
create unique index if not exists webhook_endpoints_url_uniq
  on public.webhook_endpoints (url);

-- ---------------------------------------------------------------------------
-- Bump the version ONLY when a field that actually syncs changes.
--
-- Only id/name/status cross the boundary (contact details deliberately do not).
-- Bumping on every UPDATE would emit a sync event every time the `metrics`
-- jsonb is refreshed, which is constant dashboard churn and none of the app
-- projects' business.
-- ---------------------------------------------------------------------------
create or replace function public.bump_client_registry_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name
     or new.status is distinct from old.status then
    new.registry_version := old.registry_version + 1;
  else
    -- Preserve it explicitly: an UPDATE that supplies a stale registry_version
    -- from a read-modify-write cycle must not roll the counter backwards.
    new.registry_version := old.registry_version;
  end if;
  return new;
end;
$$;

drop trigger if exists clients_registry_version on public.clients;
create trigger clients_registry_version
  before update on public.clients
  for each row execute function public.bump_client_registry_version();

-- ---------------------------------------------------------------------------
-- Tombstones — a deleted client still has to reach the app mirrors.
--
-- The row is gone from `clients` by the time we would notice, so capture it at
-- delete time. The sender drains this table and the mirrors set deleted_at.
-- ---------------------------------------------------------------------------
create table if not exists public.client_registry_tombstones (
  client_id   uuid primary key,
  name        text not null,
  -- Continue the deleted client's version line. Restarting at 1 would make the
  -- tombstone look older than the last live update and the receivers, which
  -- only move forward, would discard it.
  version     bigint not null,
  deleted_at  timestamptz not null default now(),
  emitted_at  timestamptz
);

create index if not exists client_tombstones_unemitted_idx
  on public.client_registry_tombstones (deleted_at)
  where emitted_at is null;

create or replace function public.record_client_tombstone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.client_registry_tombstones (client_id, name, version)
  values (old.id, old.name, old.registry_version + 1)
  on conflict (client_id) do update
    set version    = excluded.version,
        deleted_at = now(),
        emitted_at = null;
  return old;
end;
$$;

drop trigger if exists clients_registry_tombstone on public.clients;
create trigger clients_registry_tombstone
  after delete on public.clients
  for each row execute function public.record_client_tombstone();

alter table public.client_registry_tombstones enable row level security;
revoke all on table public.client_registry_tombstones from anon, authenticated;

comment on table public.client_registry_tombstones is
  'Deleted clients awaiting propagation to the per-app Supabase projects. '
  'Drained by lib/webhooks/registry-sync.ts. A row with emitted_at set has '
  'been queued to every registry endpoint; it is kept as the audit record of '
  'when the deletion was propagated.';
