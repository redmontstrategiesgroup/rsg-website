-- Industry vertical content overrides (admin-managed).
-- Authored defaults ship in code (lib/industries/content); this table stores
-- admin edits as full-object overrides keyed by vertical slug, plus the
-- secondary-industries list under slug 'additional-industries'.

create table if not exists public.industry_verticals (
  slug text primary key,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Service-role access only (the app server uses the service key; there is no
-- client-side access to this table).
alter table public.industry_verticals enable row level security;
