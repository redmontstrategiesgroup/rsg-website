-- ============================================================================
-- NEXUS — domain schema
--
-- Ports the `nexus_world_v1` localStorage save (NEXUS/js/app.js) to Postgres.
--
-- Shape note: the city stays ONE jsonb document rather than becoming tables of
-- buildings, businesses and residents. The simulation tick reads and writes the
-- whole world atomically every step (sim.js / economy.js / social.js); shredding
-- it across a dozen tables would mean a dozen round-trips per tick and a
-- rewrite of the engine, to buy queries nothing in the app performs. What the
-- database is actually being asked for here is durability, multi-device access
-- and save slots — and it delivers all three against a jsonb column.
--
-- The columns promoted out of the blob are the ones the save-slot list shows,
-- so listing saves never has to parse a multi-megabyte document.
-- ============================================================================

create table if not exists public.nexus_worlds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users (id) on delete cascade,
  name        text not null default 'Nexus City',
  slot        integer not null default 1,

  -- promoted for the save-slot list
  day         integer not null default 1,
  minute      integer not null default 360,
  treasury    numeric(14, 2),
  population  integer,

  state       jsonb not null,            -- the whole world document
  saved_at    timestamptz not null default now(),
  created_at  timestamptz not null default now(),

  unique (user_id, slot)
);

create index if not exists nexus_worlds_user_idx on public.nexus_worlds (user_id, saved_at desc);

comment on column public.nexus_worlds.state is
  'The complete NEXUS world document (buildings, businesses, residents, stats, '
  'election, feed, eventLog, digests). Written whole by APP.save(); the promoted '
  'columns above are derived from it at write time for the save-slot list.';

-- ---------------------------------------------------------------------------
-- Autosave history — the sim runs continuously and an autosave can capture a
-- ruined city. A short ring of prior saves is the difference between "the
-- economy collapsed while I was away" being recoverable or terminal.
-- ---------------------------------------------------------------------------
create table if not exists public.nexus_world_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users (id) on delete cascade,
  world_id    uuid not null references public.nexus_worlds (id) on delete cascade,
  day         integer not null default 1,
  state       jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists nexus_snapshots_world_idx
  on public.nexus_world_snapshots (world_id, created_at desc);

-- Keep the last 10 snapshots per world. Runs on insert; bounded work, and the
-- bound is here rather than in the client so it holds no matter which device
-- saved.
create or replace function public.nexus_trim_snapshots()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.nexus_world_snapshots
  where world_id = new.world_id
    and id not in (
      select id from public.nexus_world_snapshots
      where world_id = new.world_id
      order by created_at desc
      limit 10
    );
  return null;
end;
$$;

drop trigger if exists nexus_trim_snapshots_trg on public.nexus_world_snapshots;
create trigger nexus_trim_snapshots_trg
  after insert on public.nexus_world_snapshots
  for each row execute function public.nexus_trim_snapshots();

-- ---------------------------------------------------------------------------
-- Preferences (voice / model choice — `nexus_*` prefs in CONTRACTS.md).
-- ---------------------------------------------------------------------------
create table if not exists public.nexus_settings (
  user_id     uuid primary key references public.app_users (id) on delete cascade,
  model       text not null default 'claude-haiku-4-5-20251001',
  voice       text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.nexus_worlds          enable row level security;
alter table public.nexus_world_snapshots enable row level security;
alter table public.nexus_settings        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['nexus_worlds','nexus_world_snapshots','nexus_settings'] loop
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format($f$
      create policy %I on public.%I
        for all to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))
    $f$, t || '_own', t);
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end $$;
