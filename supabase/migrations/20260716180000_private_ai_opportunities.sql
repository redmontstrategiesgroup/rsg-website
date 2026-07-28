-- Custom Private AI Systems opportunity pipeline
-- Stores designer configurations and private-AI sales stages.

create table if not exists public.private_ai_opportunities (
  id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new_inquiry',
  name text not null default '',
  business_name text not null default '',
  email text not null default '',
  phone text not null default '',
  industry text not null default '',
  employees text not null default '',
  locations text not null default '',
  current_software text not null default '',
  privacy_concerns text not null default '',
  timeline text not null default '',
  notes text not null default '',
  owner text not null default '',
  admin_notes text not null default '',
  lead_id text,
  config jsonb not null default '{}'::jsonb,
  architecture jsonb not null default '{}'::jsonb,
  deployment_preference text not null default 'private_cloud',
  privacy_level text not null default '',
  existing_infrastructure text not null default '',
  data_types text not null default '',
  required_integrations text not null default '',
  estimated_users text not null default '',
  internet_availability text not null default '',
  hardware_availability text not null default '',
  compliance_considerations text not null default '',
  approval_requirements text not null default '',
  budget_range text not null default '',
  technical_notes text not null default '',
  security_notes text not null default '',
  activity jsonb not null default '[]'::jsonb
);

create index if not exists private_ai_opportunities_status_idx
  on public.private_ai_opportunities (status);
create index if not exists private_ai_opportunities_created_idx
  on public.private_ai_opportunities (created_at desc);

alter table public.private_ai_opportunities enable row level security;

-- Service-role / server only (no public policies).

-- Booking help category for Custom Private AI Systems
insert into public.services (id, name, slug, description, sort_order, active)
values (
  'b1000000-0000-4000-8000-000000000009',
  'Design a custom private AI system',
  'custom-private-ai',
  'AI built around your workflows, data, and security requirements—not public generic tools.',
  55,
  true
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  sort_order = excluded.sort_order,
  active = true;
