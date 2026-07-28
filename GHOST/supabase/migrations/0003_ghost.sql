-- ============================================================================
-- GHOST — domain schema
--
-- Ports the `ghost:v2` localStorage blob (GHOST/js/store.js) to Postgres. The
-- eleven collections in COLLECTIONS become eleven tables.
--
-- Shape note: each table promotes the few fields GHOST actually filters and
-- sorts on into real columns, and keeps the rest of the object in `data jsonb`.
-- That is deliberate. GHOST's store is a generic id-keyed object store and its
-- records carry app-defined fields that vary by kind; fully normalising them
-- would mean rewriting the engine, planner and orchestrator, not just the
-- storage layer. Promoted columns give indexes and RLS something to bite on
-- while the existing object shapes keep working.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- World model
-- ---------------------------------------------------------------------------
create table if not exists public.ghost_entities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users (id) on delete cascade,
  kind        text not null,            -- system | device | client | deployment | …
  name        text not null default '',
  status      text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ghost_entities_user_idx on public.ghost_entities (user_id, kind);

create table if not exists public.ghost_edges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users (id) on delete cascade,
  from_id     uuid not null references public.ghost_entities (id) on delete cascade,
  to_id       uuid not null references public.ghost_entities (id) on delete cascade,
  rel         text not null,            -- typed relationship
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  -- one edge of a given type between two nodes; re-asserting it is an update
  unique (from_id, to_id, rel)
);
create index if not exists ghost_edges_user_idx on public.ghost_edges (user_id);
create index if not exists ghost_edges_from_idx on public.ghost_edges (from_id);
create index if not exists ghost_edges_to_idx   on public.ghost_edges (to_id);

-- ---------------------------------------------------------------------------
-- Operator intent → execution
-- ---------------------------------------------------------------------------
create table if not exists public.ghost_commands (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users (id) on delete cascade,
  text        text not null,            -- the natural-language directive
  status      text not null default 'new',
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ghost_commands_user_idx on public.ghost_commands (user_id, created_at desc);

create table if not exists public.ghost_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users (id) on delete cascade,
  command_id  uuid references public.ghost_commands (id) on delete set null,
  title       text not null default '',
  status      text not null default 'draft',
  data        jsonb not null default '{}'::jsonb,   -- steps, rationale, risk notes
  created_at  timestamptz not null default now()
);
create index if not exists ghost_plans_user_idx on public.ghost_plans (user_id, created_at desc);

create table if not exists public.ghost_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users (id) on delete cascade,
  plan_id     uuid references public.ghost_plans (id) on delete set null,
  status      text not null default 'pending',      -- pending | running | done | failed
  started_at  timestamptz,
  ended_at    timestamptz,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ghost_runs_user_idx on public.ghost_runs (user_id, created_at desc);

create table if not exists public.ghost_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users (id) on delete cascade,
  run_id      uuid references public.ghost_runs (id) on delete cascade,
  seq         integer not null default 0,
  title       text not null default '',
  status      text not null default 'pending',
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ghost_tasks_run_idx on public.ghost_tasks (run_id, seq);
create index if not exists ghost_tasks_user_idx on public.ghost_tasks (user_id);

-- ---------------------------------------------------------------------------
-- Human-in-the-loop + proof
-- ---------------------------------------------------------------------------
create table if not exists public.ghost_approvals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users (id) on delete cascade,
  task_id     uuid references public.ghost_tasks (id) on delete cascade,
  status      text not null default 'pending',      -- pending | approved | rejected
  decided_at  timestamptz,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ghost_approvals_user_idx on public.ghost_approvals (user_id, status);

create table if not exists public.ghost_verifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users (id) on delete cascade,
  task_id     uuid references public.ghost_tasks (id) on delete cascade,
  ok          boolean not null default false,
  method      text,                                  -- how the claim was checked
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ghost_verifications_task_idx on public.ghost_verifications (task_id);
create index if not exists ghost_verifications_user_idx on public.ghost_verifications (user_id);

-- ---------------------------------------------------------------------------
-- Operator surface
--
-- There is deliberately no ghost_memories table. The client-side collection it
-- mirrored was declared but never written or read, and a memory store with no
-- writer is an unscoped dumping ground waiting to happen — one holding operator
-- text under RLS, which makes it a privacy surface as soon as anything fills it.
-- GHOST remembers through ghost_audit + ghost_entities, which cannot drift from
-- the truth. See docs/plans/memory-architecture.md §E.
-- ---------------------------------------------------------------------------
create table if not exists public.ghost_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users (id) on delete cascade,
  level       text not null default 'info',
  body        text not null default '',
  read_at     timestamptz,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ghost_notifications_user_idx
  on public.ghost_notifications (user_id, created_at desc);

create table if not exists public.ghost_settings (
  user_id     uuid primary key references public.app_users (id) on delete cascade,
  active_view text not null default 'ops',
  mode        text not null default 'build',
  seeded      boolean not null default false,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ghost_audit — append-only. This is the table that makes GHOST's actions
-- "real (persisted + inspectable)" per store.js. It gets INSERT and SELECT
-- policies and no UPDATE or DELETE policy at all, so an append-only log is
-- append-only in the database rather than by convention. The 2000-record
-- trim in store.js is dropped: storage is no longer a 5MB browser quota, and
-- silently discarding audit history is the opposite of what this table is for.
-- ---------------------------------------------------------------------------
create table if not exists public.ghost_audit (
  id          bigserial primary key,
  user_id     uuid not null references public.app_users (id) on delete cascade,
  action      text not null,
  coll        text,
  target_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ghost_audit_user_idx on public.ghost_audit (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — the browser reaches this database directly with the publishable key,
-- so these policies are the whole isolation boundary.
-- ---------------------------------------------------------------------------
alter table public.ghost_entities      enable row level security;
alter table public.ghost_edges         enable row level security;
alter table public.ghost_commands      enable row level security;
alter table public.ghost_plans         enable row level security;
alter table public.ghost_runs          enable row level security;
alter table public.ghost_tasks         enable row level security;
alter table public.ghost_approvals     enable row level security;
alter table public.ghost_verifications enable row level security;
alter table public.ghost_notifications enable row level security;
alter table public.ghost_settings      enable row level security;
alter table public.ghost_audit         enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'ghost_entities','ghost_edges','ghost_commands','ghost_plans','ghost_runs',
    'ghost_tasks','ghost_approvals','ghost_verifications',
    'ghost_notifications','ghost_settings'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    -- WITH CHECK as well as USING: without it a user can UPDATE a row they own
    -- and set user_id to someone else, handing their data away.
    execute format($f$
      create policy %I on public.%I
        for all to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))
    $f$, t || '_own', t);
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end $$;

-- Audit: insert and read your own. No update/delete policy — deliberately.
drop policy if exists ghost_audit_insert_own on public.ghost_audit;
create policy ghost_audit_insert_own on public.ghost_audit
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists ghost_audit_read_own on public.ghost_audit;
create policy ghost_audit_read_own on public.ghost_audit
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.ghost_audit from anon;
