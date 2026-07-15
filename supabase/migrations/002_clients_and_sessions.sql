-- Client portal: real accounts + DB-backed, revocable sessions.
-- Run after 001_create_leads.sql. Both tables are service-role only (RLS on,
-- no public policies) — the app reads/writes with the service-role key.

-- ---- Client accounts --------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  name text not null,
  company text not null,
  plan text not null default 'Strategy Audit',
  member_since text,
  strategist text default 'Redmont Strategies Group',
  -- Dashboard payload, stored as JSON so a client is one row.
  metrics jsonb not null default '[]'::jsonb,
  systems jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  activity jsonb not null default '[]'::jsonb,
  deliverables jsonb not null default '[]'::jsonb,
  invoices jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Case-insensitive unique email (login looks up lowercased).
create unique index if not exists clients_email_lower_idx
  on public.clients (lower(email));

-- ---- Sessions (one row per active login; enables revocation) ----------
create table if not exists public.sessions (
  id uuid primary key,                    -- session id carried in the cookie
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,                 -- set to revoke without deleting
  user_agent text,
  ip text
);

create index if not exists sessions_client_id_idx on public.sessions (client_id);
create index if not exists sessions_expires_at_idx on public.sessions (expires_at);

alter table public.clients enable row level security;
alter table public.sessions enable row level security;
-- No RLS policies: all access is via the service-role key.
