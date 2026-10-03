-- Marketing list signups (components/EmailCapture.tsx -> app/api/subscribe).
--
-- Until now subscribers only ever reached the local JSON file store, which
-- refuses writes in production: every production signup was notification-only
-- and the admin console's subscriber list was permanently empty. This gives
-- them the same durable home the leads table already provides.
--
-- Idempotent: safe to re-run against a database that already has the table.

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  -- Stored lower-cased by the app, so a plain unique column constraint is a
  -- true case-insensitive dedupe. It must be a column constraint (not an
  -- expression index) for PostgREST's on_conflict=email to resolve it.
  email text not null unique,
  source text not null default 'popup',
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscribers_created_at_idx
  on public.subscribers (created_at desc);

-- Deny-all by default. The app connects with the service-role key, which
-- bypasses RLS, so no permissive policy is needed (matches public.leads).
alter table public.subscribers enable row level security;
