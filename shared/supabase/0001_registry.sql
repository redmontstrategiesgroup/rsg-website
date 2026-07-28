-- ============================================================================
-- RSG shared client registry — IDENTICAL in every app project.
--
-- Canonical copy: shared/supabase/0001_registry.sql
-- Vendored to:    <app>/supabase/migrations/0001_registry.sql  (do not edit there)
--
-- Each app has its own database and its own auth.users. This file supplies the
-- one thing they hold in common: a read-only mirror of the website's client
-- registry, and the link from a local auth user to a client.
--
-- See docs/per-app-supabase.md §2.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- rsg_clients — mirror of `clients` in the website project.
-- Downstream-read-only: written ONLY by the registry-sync edge function via
-- the service role. No app code writes this table.
-- ---------------------------------------------------------------------------
create table if not exists public.rsg_clients (
  id          uuid primary key,               -- the website's clients.id, verbatim
  name        text not null,
  status      text not null default 'active', -- active | suspended | closed
  version     bigint not null,                -- monotonic upstream; ordering key
  deleted_at  timestamptz,                    -- tombstone; never hard-deleted here
  synced_at   timestamptz not null default now()
);

comment on table public.rsg_clients is
  'Read-only mirror of the website project''s clients table. Written only by the '
  'registry-sync edge function. Holds id/name/status/version and nothing else — '
  'contact details deliberately do not sync (docs/per-app-supabase.md §2).';

-- ---------------------------------------------------------------------------
-- rsg_registry_events — idempotency ledger for the sync.
-- A redelivered event_id is a no-op instead of a rollback of newer state.
-- ---------------------------------------------------------------------------
-- event_id is TEXT, not uuid. The website's sender builds it as
-- `registry.client:<client-uuid>:<version>` (basic website/lib/webhooks/
-- registry-sync.ts) precisely so the same version cannot be queued twice.
-- Typing this column uuid rejected every real event with "invalid input syntax
-- for type uuid" — verified against Postgres 17 — which meant the idempotency
-- ledger recorded nothing and dedupe silently failed open. Match the sender.
create table if not exists public.rsg_registry_events (
  event_id    text primary key,
  client_id   uuid not null,
  version     bigint not null,
  applied     boolean not null,  -- false = received but stale (version <= current)
  received_at timestamptz not null default now()
);

create index if not exists rsg_registry_events_client_idx
  on public.rsg_registry_events (client_id, received_at desc);

-- ---------------------------------------------------------------------------
-- app_users — this project's auth user, optionally linked to a registry client.
--
-- client_id is NULLABLE on purpose: a self-serve signup with no RSG client
-- behind it is a valid state, and it is how this app gets sold standalone.
-- Never assume the link exists.
-- ---------------------------------------------------------------------------
create table if not exists public.app_users (
  id         uuid primary key references auth.users (id) on delete cascade,
  client_id  uuid references public.rsg_clients (id),  -- no cascade: tombstone, don't drop the user
  role       text not null default 'member',           -- member | admin
  created_at timestamptz not null default now()
);

create index if not exists app_users_client_idx on public.app_users (client_id);

-- ---------------------------------------------------------------------------
-- current_client_id() — the caller's client, for app-table RLS.
--
-- SECURITY DEFINER so it can read app_users without recursing through that
-- table's own policy. Empty search_path + fully-qualified names: a mutable
-- search_path on a definer function is a privilege-escalation path.
-- ---------------------------------------------------------------------------
create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select client_id from public.app_users where id = auth.uid();
$$;

revoke all on function public.current_client_id() from public;
grant execute on function public.current_client_id() to authenticated;

-- ---------------------------------------------------------------------------
-- handle_new_user() — every auth signup gets an app_users row immediately, so
-- app tables can foreign-key it without a race against first login.
-- Linking to a client happens later (invite redemption or admin action).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_users (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
--
-- The browser talks to this database directly with the publishable (anon) key,
-- so these policies ARE the isolation boundary. There is no server-side filter
-- behind them to catch a mistake.
-- ---------------------------------------------------------------------------
alter table public.rsg_clients          enable row level security;
alter table public.rsg_registry_events  enable row level security;
alter table public.app_users            enable row level security;

-- rsg_clients: you may read your own client, and only if it is not tombstoned.
-- No insert/update/delete policy exists for anyone — the service role bypasses
-- RLS and is the only writer.
drop policy if exists rsg_clients_read_own on public.rsg_clients;
create policy rsg_clients_read_own on public.rsg_clients
  for select to authenticated
  using (id = public.current_client_id() and deleted_at is null);

-- rsg_registry_events: operational data. Service role only — no policies.

-- app_users: read your own row. You may NOT update it: role and client_id are
-- privilege, and a user who can set their own client_id can join any client.
drop policy if exists app_users_read_self on public.app_users;
create policy app_users_read_self on public.app_users
  for select to authenticated
  using (id = (select auth.uid()));

-- No anon access to any registry table.
revoke all on table public.rsg_clients         from anon;
revoke all on table public.rsg_registry_events from anon, authenticated;
revoke all on table public.app_users           from anon;
