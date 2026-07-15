-- Connect (link-in-bio) page: settings, links, and first-party events.
-- Safe to re-run. Service-role access only (RLS on, no public policies).

create table if not exists public.connect_settings (
  id text primary key default 'default',
  headline text not null default 'Redmont Strategies Group',
  description text not null default 'Business Consulting, AI Implementation, Automation, and Digital Infrastructure.',
  badge_label text not null default 'Official RSG Page',
  campaign_title text,
  campaign_description text,
  campaign_url text,
  campaign_badge text,
  campaign_active boolean not null default true,
  social_linkedin text,
  social_instagram text,
  social_facebook text,
  social_email text not null default 'contact@redmontstrategiesgroup.com',
  published boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.connect_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  url text not null,
  icon text not null default 'link',
  badge text,
  display_order integer not null default 0,
  featured boolean not null default false,
  active boolean not null default true,
  open_new_tab boolean not null default false,
  starts_at timestamptz,
  expires_at timestamptz,
  sources text[] default '{}',
  utm_params jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.connect_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  link_id text,
  session_id text,
  visitor_id text,
  source text,
  medium text,
  campaign text,
  referrer text,
  device text,
  path text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.connect_settings enable row level security;
alter table public.connect_links enable row level security;
alter table public.connect_events enable row level security;

create index if not exists connect_links_order_idx on public.connect_links (display_order asc);
create index if not exists connect_events_created_idx on public.connect_events (created_at desc);
create index if not exists connect_events_type_idx on public.connect_events (event_type);
