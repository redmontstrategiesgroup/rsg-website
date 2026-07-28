-- ============================================================================
-- Onehand OS — domain schema
--
-- Onehand OS is the shell, and the sole writer of the two shared contracts in
-- CONTRACTS.md. Under the per-app split it becomes the custodian of the more
-- sensitive one: the ability profile (`rsg.ability.v1`).
--
-- The ability profile describes a person's motor function — which fingers they
-- can use, reach, grip, tremor, fatigue, whether the condition is permanent.
-- It is the most sensitive data in the portfolio. It lives HERE and is not
-- mirrored into the other four app databases. Apps read it live, per grant,
-- through the `profile-read` edge function, so a revoked grant takes effect on
-- the next call rather than at the next sync (docs/per-app-supabase.md §2).
--
-- Design rule carried over from CONTRACTS.md and kept enforceable below:
-- fields describe FUNCTION, NOT DIAGNOSIS. There is no diagnosis column. A
-- diagnosis predicts need worse and raises the data's sensitivity tier for
-- nothing.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- onehand_profiles — one ability profile per user.
--
-- Unanswered dimensions are stored as NULL and MUST NOT be defaulted to a
-- middle value. CONTRACTS.md is explicit: `precision` and `permanence` are
-- omitted entirely when the person has not answered, so ability-resolver.js can
-- report them in layout.unresolved and the gap stays visible. A guessed
-- 'moderate' is indistinguishable from a stated one, and it silently produces a
-- layout tuned to a person who does not exist.
-- ---------------------------------------------------------------------------
create table if not exists public.onehand_profiles (
  user_id      uuid primary key references public.app_users (id) on delete cascade,
  v            smallint not null default 1,
  hand         text     not null default 'right',   -- right | left
  fingers      jsonb    not null default
                 '{"thumb":true,"index":true,"middle":true,"ring":true,"pinky":true}'::jsonb,
  reach_mm     integer,
  grip         text,          -- weak | moderate | strong        — NULL = unanswered
  fatigue      text,          -- low | med | high                — NULL = unanswered
  precision    text,          -- low | moderate | high           — NULL = unanswered
  permanence   text,          -- temporary | permanent | changing— NULL = unanswered
  inputs       text[] not null default '{}',        -- voice | foot | switch
  target_scale numeric(4, 2) not null default 1.40,
  updated_at   timestamptz not null default now(),

  constraint onehand_hand_valid       check (hand in ('right', 'left')),
  constraint onehand_grip_valid       check (grip is null or grip in ('weak','moderate','strong')),
  constraint onehand_fatigue_valid    check (fatigue is null or fatigue in ('low','med','high')),
  constraint onehand_precision_valid  check (precision is null or precision in ('low','moderate','high')),
  constraint onehand_permanence_valid check (permanence is null or permanence in ('temporary','permanent','changing'))
);

comment on table public.onehand_profiles is
  'Ability profile (rsg.ability.v1). Sensitive: describes a person''s motor '
  'function. Never mirrored to other app databases; read live per grant. '
  'NULL in grip/fatigue/precision/permanence means UNANSWERED — do not default.';

-- ---------------------------------------------------------------------------
-- onehand_profile_grants — per-app consent to read the profile.
--
-- Absence of a row means no consent. Revocation sets revoked_at rather than
-- deleting, so "did this app ever have access, and when did that stop" stays
-- answerable — which is the question that actually gets asked.
-- ---------------------------------------------------------------------------
create table if not exists public.onehand_profile_grants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users (id) on delete cascade,
  app         text not null,        -- ghost | nexus | observatory | forge
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  unique (user_id, app)
);
create index if not exists onehand_grants_user_idx on public.onehand_profile_grants (user_id);

create or replace function public.onehand_has_grant(p_user uuid, p_app text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.onehand_profile_grants
    where user_id = p_user and app = p_app and revoked_at is null
  );
$$;

revoke all on function public.onehand_has_grant(uuid, text) from public;
grant execute on function public.onehand_has_grant(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- onehand_access_log — append-only record of every profile read, by app.
--
-- This is what lets a person answer "who has looked at this, and when". For
-- data this sensitive, a grant you cannot audit is not meaningfully a grant.
-- Written by the profile-read edge function (service role).
-- ---------------------------------------------------------------------------
create table if not exists public.onehand_access_log (
  id          bigserial primary key,
  user_id     uuid not null references public.app_users (id) on delete cascade,
  app         text not null,
  action      text not null,       -- read | grant | revoke | update
  ok          boolean not null default true,   -- false = denied (no grant)
  created_at  timestamptz not null default now()
);
create index if not exists onehand_access_user_idx
  on public.onehand_access_log (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Shell preferences (`ohos.*`). Not sensitive; kept separate from the profile
-- so a UI preference read never touches the ability table.
-- ---------------------------------------------------------------------------
create table if not exists public.onehand_settings (
  user_id     uuid primary key references public.app_users (id) on delete cascade,
  hand        text not null default 'right',
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.onehand_profiles       enable row level security;
alter table public.onehand_profile_grants enable row level security;
alter table public.onehand_access_log     enable row level security;
alter table public.onehand_settings       enable row level security;

-- The profile: readable and writable only by the person it describes. Other
-- apps never reach this table directly — they call profile-read, which runs as
-- service role and checks the grant first.
drop policy if exists onehand_profiles_own on public.onehand_profiles;
create policy onehand_profiles_own on public.onehand_profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Grants: the person may see and change their own, including revoking.
drop policy if exists onehand_grants_own on public.onehand_profile_grants;
create policy onehand_grants_own on public.onehand_profile_grants
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Access log: readable by the person, insertable only by the service role.
-- No insert policy — a client that can forge access-log rows can hide a read.
drop policy if exists onehand_access_read_own on public.onehand_access_log;
create policy onehand_access_read_own on public.onehand_access_log
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists onehand_settings_own on public.onehand_settings;
create policy onehand_settings_own on public.onehand_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table public.onehand_profiles       from anon;
revoke all on table public.onehand_profile_grants from anon;
revoke all on table public.onehand_settings       from anon;

-- The access log is the one table a person must be able to READ but never
-- WRITE. Revoking it from `authenticated` outright (as this file used to) also
-- killed the onehand_access_read_own policy above — the grant is what lets the
-- policy run at all, so "select permission denied" was the answer to "who has
-- looked at my ability profile". Verified against Postgres 17.
--
-- Grant SELECT only, and let the policy narrow it to the person's own rows.
-- Insert stays service-role-only: a client that can forge access-log rows can
-- hide a read, which is the whole point of the table.
revoke all     on table public.onehand_access_log from anon, authenticated;
grant  select  on table public.onehand_access_log to   authenticated;
