-- API platform (spec: docs/superpowers/specs/2026-09-15-api-platform-design.md)
-- One migration for all four phases so later phases need no schema change.

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  principal_type text not null check (principal_type in ('client','admin')),
  principal_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null,
  created_by text not null,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists api_keys_principal_idx
  on public.api_keys (principal_type, principal_id) where revoked_at is null;
alter table public.api_keys enable row level security;

create table if not exists public.api_idempotency (
  principal_id uuid not null,
  key text not null,
  request_hash text not null,
  status text not null check (status in ('in_flight','done')),
  response_status int,
  response_body jsonb,
  created_at timestamptz not null default now(),
  primary key (principal_id, key)
);
create index if not exists api_idempotency_created_idx on public.api_idempotency (created_at);
alter table public.api_idempotency enable row level security;

create table if not exists public.api_requests (
  id bigint generated always as identity primary key,
  key_id uuid,
  principal_type text,
  principal_id uuid,
  method text not null,
  path text not null,
  status int not null,
  duration_ms int not null,
  ip text,
  correlation_id text,
  created_at timestamptz not null default now()
);
create index if not exists api_requests_key_created_idx
  on public.api_requests (key_id, created_at desc);
create index if not exists api_requests_created_idx on public.api_requests (created_at);
alter table public.api_requests enable row level security;

-- Soft delete for leads (admin API, Phase 2).
alter table public.leads add column if not exists deleted_at timestamptz;

-- Briefs submitted by / for a client through the client API. Executive briefs
-- created by RSG keep null.
alter table public.briefs add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists briefs_client_idx on public.briefs (client_id, created_at desc)
  where client_id is not null;

-- Webhook ownership + subscriptions (Phase 3 uses these; schema lands now).
alter table public.webhook_endpoints
  add column if not exists owner_type text check (owner_type in ('client','admin')),
  add column if not exists owner_id uuid,
  add column if not exists events text[] not null default '{}',
  add column if not exists api_key_id uuid references public.api_keys(id) on delete set null,
  add column if not exists disabled_at timestamptz,
  add column if not exists failure_count int not null default 0;
create index if not exists webhook_endpoints_owner_idx
  on public.webhook_endpoints (owner_type, owner_id) where disabled_at is null;
