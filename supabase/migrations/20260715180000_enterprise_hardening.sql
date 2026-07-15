-- Enterprise hardening: admins, revocable admin sessions, audit, email queue, retention.

-- ---- Admin accounts (multi-admin + MFA) --------------------------------
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  password_hash text not null,
  role text not null default 'administrator'
    check (role in ('owner', 'administrator', 'scheduler', 'consultant', 'sales', 'viewer')),
  mfa_secret text,
  mfa_enabled boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admins_email_lower_idx
  on public.admins (lower(email));

alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;

-- ---- Admin sessions (revocable) ---------------------------------------
create table if not exists public.admin_sessions (
  id uuid primary key,
  admin_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  user_agent text,
  ip text
);

create index if not exists admin_sessions_admin_id_idx on public.admin_sessions (admin_id);
create index if not exists admin_sessions_expires_at_idx on public.admin_sessions (expires_at);

alter table public.admin_sessions enable row level security;
revoke all on table public.admin_sessions from anon, authenticated;

-- ---- Unified audit events ---------------------------------------------
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('admin', 'system', 'cron', 'anonymous')),
  actor_id text,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_created_at_idx on public.audit_events (created_at desc);
create index if not exists audit_events_action_idx on public.audit_events (action);
create index if not exists audit_events_actor_email_idx on public.audit_events (actor_email);

alter table public.audit_events enable row level security;
revoke all on table public.audit_events from anon, authenticated;

-- ---- Outbound email retry queue (contact / non-scheduling) ------------
create table if not exists public.email_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'contact_notification',
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts int not null default 0,
  max_attempts int not null default 5,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_jobs_pending_idx
  on public.email_jobs (next_attempt_at)
  where status = 'pending';

alter table public.email_jobs enable row level security;
revoke all on table public.email_jobs from anon, authenticated;

-- Explicit revoke on scheduling/connect (defense in depth)
do $$
begin
  if to_regclass('public.bookings') is not null then
    revoke all on table public.bookings from anon, authenticated;
  end if;
  if to_regclass('public.connect_links') is not null then
    revoke all on table public.connect_links from anon, authenticated;
  end if;
  if to_regclass('public.connect_events') is not null then
    revoke all on table public.connect_events from anon, authenticated;
  end if;
end $$;
