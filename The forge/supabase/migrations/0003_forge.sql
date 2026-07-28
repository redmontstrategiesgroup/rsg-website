-- ============================================================================
-- THE FORGE — domain schema
--
-- Ports `forge.settings.v1` and the in-memory spec (The forge/js/spec.js) to
-- Postgres: specs, their revision history, and export records.
--
-- What deliberately does NOT come across: `settings.apiKey`. The Anthropic key
-- stops living in browser storage entirely — it moves into the project's
-- Supabase secrets behind the `ai` edge function (docs/per-app-supabase.md §4).
-- There is no api_key column here and there should never be one.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Specs — one row per design the user is working on. `spec` holds the document
-- defaultSpec() produces; the columns promoted out of it are the ones the
-- design picker and the manufacturing checks read.
-- ---------------------------------------------------------------------------
create table if not exists public.forge_specs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.app_users (id) on delete cascade,
  name          text not null default 'Untitled',
  tagline       text not null default '',
  mode          text not null default 'product',   -- product | part | …
  rev           integer not null default 1,
  mcu           text,
  layout_style  text not null default 'arc',       -- arc | grid
  printer_bed_mm  numeric(8, 2),                   -- null = not yet interviewed
  budget_usd      numeric(10, 2),                  -- null = unconstrained, NOT zero
  spec          jsonb not null default '{}'::jsonb, -- modules, geometry, ability, derived
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists forge_specs_user_idx on public.forge_specs (user_id, updated_at desc);

comment on column public.forge_specs.printer_bed_mm is
  'Null means the requirements interview has not asked yet — distinct from a '
  'small bed. Do not default it to a number; an assumed bed size silently '
  'produces a model that will not fit the printer the user actually owns.';

-- ---------------------------------------------------------------------------
-- Revisions — spec.history, as rows. Each entry is the findings applied at a
-- given rev, so a design's evolution is inspectable rather than a nested array
-- that only ever grows inside one document.
-- ---------------------------------------------------------------------------
create table if not exists public.forge_revisions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users (id) on delete cascade,
  spec_id     uuid not null references public.forge_specs (id) on delete cascade,
  rev         integer not null,
  findings    jsonb not null default '[]'::jsonb,
  snapshot    jsonb not null default '{}'::jsonb,  -- the full spec at this rev
  created_at  timestamptz not null default now(),
  unique (spec_id, rev)
);
create index if not exists forge_revisions_spec_idx on public.forge_revisions (spec_id, rev desc);
create index if not exists forge_revisions_user_idx on public.forge_revisions (user_id);

-- ---------------------------------------------------------------------------
-- Exports — a generated artefact plus the verdict of the geometry checks that
-- ran on it (the tier-1 validation from commit ff24626: invalid solids,
-- wrong-size exports, unfalsifiable DFM).
--
-- `valid` is nullable on purpose. NULL means "not checked", which is not the
-- same as "passed", and an export that was never validated must not be able to
-- present itself as a clean one.
-- ---------------------------------------------------------------------------
create table if not exists public.forge_exports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.app_users (id) on delete cascade,
  spec_id       uuid not null references public.forge_specs (id) on delete cascade,
  rev           integer not null,
  kind          text not null,                    -- stl | step | gerber | bom | firmware
  filename      text not null default '',
  byte_size     bigint,
  checksum      text,                             -- sha-256 of the artefact
  valid         boolean,                          -- NULL = not validated
  validation    jsonb not null default '{}'::jsonb, -- watertight, manifold, bbox_mm,
                                                    -- min_wall_mm, self_intersections
  created_at    timestamptz not null default now()
);
create index if not exists forge_exports_spec_idx on public.forge_exports (spec_id, created_at desc);
create index if not exists forge_exports_user_idx on public.forge_exports (user_id);

comment on column public.forge_exports.valid is
  'NULL = geometry checks have not run. Treat NULL as unproven, never as pass. '
  'A model that renders correctly on screen can still be non-manifold and '
  'unmanufacturable.';

-- ---------------------------------------------------------------------------
-- Settings — model choice only. No API key (see header).
-- ---------------------------------------------------------------------------
create table if not exists public.forge_settings (
  user_id     uuid primary key references public.app_users (id) on delete cascade,
  model       text not null default 'claude-fable-5',
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.forge_specs     enable row level security;
alter table public.forge_revisions enable row level security;
alter table public.forge_exports   enable row level security;
alter table public.forge_settings  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['forge_specs','forge_revisions','forge_exports','forge_settings'] loop
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
