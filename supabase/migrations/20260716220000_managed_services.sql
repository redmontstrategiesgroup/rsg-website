-- ---------------------------------------------------------------------------
-- Managed services & recurring revenue platform (July 2026)
--
-- RSG positions every implementation as the start of an ongoing partnership.
-- This migration adds the recurring-service data model:
--   * managed_service_plans   — the four standard plans + custom variations
--   * client_subscriptions    — a client's active monthly/annual agreement
--   * subscription_events     — auditable event log (also Stripe replay guard)
--   * subscription_invoices   — billing history synced from Stripe
--   * service_requests        — structured client requests with SLA context
--   * maintenance_logs        — completed work / hours consumed
--   * service_reports         — monthly service & system-health reports
--   * client_roadmaps         — quarterly renewal & expansion roadmaps
--   * proposals               — implementation / monthly / combined proposals
--
-- Pricing lives here (admin-editable), never hard-coded in components.
-- All tables are service-role only: RLS enabled with no public policies,
-- matching every other table in this project.
-- ---------------------------------------------------------------------------

-- 1. Plans -------------------------------------------------------------------

create table if not exists public.managed_service_plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  tagline text not null default '',
  best_fit text not null default '',
  description text not null default '',
  -- Pricing (cents; null monthly price = custom quote)
  monthly_price_cents integer,
  annual_price_cents integer,
  annual_discount_pct numeric(5,2) not null default 0,
  setup_fee_cents integer not null default 0,
  custom_pricing boolean not null default false,
  -- Included service
  included_hours numeric(6,2),
  additional_hourly_rate_cents integer,
  support_level text not null default '',
  response_time text not null default '',
  minimum_commitment_months integer not null default 0,
  cancellation_terms text not null default '',
  features jsonb not null default '[]'::jsonb,
  detailed_scope jsonb not null default '[]'::jsonb,
  addons jsonb not null default '[]'::jsonb,
  comparison jsonb not null default '{}'::jsonb,
  -- Presentation / behavior
  recommended boolean not null default false,
  business_critical boolean not null default false,
  tier_rank integer not null default 0,
  base_plan_key text,
  client_id uuid references public.clients(id) on delete set null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists managed_service_plans_active_idx
  on public.managed_service_plans (active, sort_order);
create index if not exists managed_service_plans_client_idx
  on public.managed_service_plans (client_id) where client_id is not null;

-- 2. Subscriptions -----------------------------------------------------------

create table if not exists public.client_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  plan_id uuid not null references public.managed_service_plans(id),
  status text not null default 'pending' check (status in (
    'pending', 'awaiting_payment', 'active', 'past_due',
    'paused', 'pending_cancellation', 'cancelled'
  )),
  billing_frequency text not null default 'monthly'
    check (billing_frequency in ('monthly', 'annual')),
  -- Effective agreement economics at signup (cents)
  monthly_price_cents integer not null default 0,
  annual_price_cents integer,
  setup_fee_cents integer not null default 0,
  currency text not null default 'usd',
  included_hours numeric(6,2),
  additional_hourly_rate_cents integer,
  minimum_commitment_months integer not null default 0,
  commitment_ends_at timestamptz,
  -- Lifecycle
  started_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancellation_requested_at timestamptz,
  cancellation_reason text,
  paused_at timestamptz,
  ended_at timestamptz,
  -- Billing provider
  stripe_customer_id text,
  stripe_subscription_id text,
  payment_method_summary text not null default '',
  last_payment_status text not null default '',
  last_payment_at timestamptz,
  failed_payment_count integer not null default 0,
  -- Ownership & service management
  account_manager text not null default '',
  technical_owner text not null default '',
  sla_notes text not null default '',
  admin_notes text not null default '',
  source text not null default 'admin',
  proposal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_subscriptions_client_idx
  on public.client_subscriptions (client_id, created_at desc);
create index if not exists client_subscriptions_status_idx
  on public.client_subscriptions (status);
create unique index if not exists client_subscriptions_stripe_sub_idx
  on public.client_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- 3. Subscription events (audit trail + Stripe webhook replay protection) ----

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.client_subscriptions(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  type text not null,
  description text not null default '',
  actor text not null default 'system',
  data jsonb not null default '{}'::jsonb,
  stripe_event_id text,
  created_at timestamptz not null default now()
);

create index if not exists subscription_events_subscription_idx
  on public.subscription_events (subscription_id, created_at desc);
-- A Stripe event id may only ever be processed once (replay defense).
create unique index if not exists subscription_events_stripe_event_idx
  on public.subscription_events (stripe_event_id)
  where stripe_event_id is not null;

-- 4. Invoices (billing history synced from the payment provider) -------------

create table if not exists public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.client_subscriptions(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  stripe_invoice_id text,
  invoice_number text not null default '',
  description text not null default '',
  amount_due_cents integer not null default 0,
  amount_paid_cents integer not null default 0,
  currency text not null default 'usd',
  status text not null default 'open',
  hosted_invoice_url text not null default '',
  invoice_pdf_url text not null default '',
  period_start timestamptz,
  period_end timestamptz,
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_invoices_client_idx
  on public.subscription_invoices (client_id, issued_at desc);
create unique index if not exists subscription_invoices_stripe_idx
  on public.subscription_invoices (stripe_invoice_id)
  where stripe_invoice_id is not null;

-- 5. Service requests ---------------------------------------------------------

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  subscription_id uuid references public.client_subscriptions(id) on delete set null,
  type text not null check (type in (
    'technical_issue', 'website_change', 'crm_change', 'automation_request',
    'ai_knowledge_update', 'new_integration', 'reporting_request',
    'security_concern', 'infrastructure_issue', 'strategy_request',
    'plan_change', 'cancellation_request', 'additional_work', 'review_request',
    'general'
  )),
  title text not null,
  details text not null default '',
  status text not null default 'new' check (status in (
    'new', 'in_review', 'approved', 'scheduled', 'in_progress',
    'waiting_on_client', 'completed', 'declined'
  )),
  priority text not null default 'standard'
    check (priority in ('standard', 'priority', 'urgent')),
  inclusion text not null default 'pending_assessment' check (inclusion in (
    'included', 'needs_approval', 'extra_charge', 'pending_assessment'
  )),
  acknowledged_consequences boolean not null default false,
  estimated_hours numeric(6,2),
  actual_hours numeric(6,2),
  extra_charge_cents integer,
  response_due_at timestamptz,
  resolved_at timestamptz,
  admin_notes text not null default '',
  activity jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_requests_client_idx
  on public.service_requests (client_id, created_at desc);
create index if not exists service_requests_status_idx
  on public.service_requests (status, created_at desc);

-- 6. Maintenance logs (completed work & hours consumed) -----------------------

create table if not exists public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  subscription_id uuid references public.client_subscriptions(id) on delete set null,
  title text not null,
  category text not null default 'maintenance' check (category in (
    'maintenance', 'update', 'backup', 'security', 'monitoring', 'fix',
    'improvement', 'development', 'automation', 'ai', 'infrastructure', 'other'
  )),
  description text not null default '',
  hours_spent numeric(6,2) not null default 0,
  performed_by text not null default '',
  performed_at timestamptz not null default now(),
  visible_to_client boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists maintenance_logs_client_idx
  on public.maintenance_logs (client_id, performed_at desc);

-- 7. Service reports -----------------------------------------------------------

create table if not exists public.service_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  subscription_id uuid references public.client_subscriptions(id) on delete set null,
  kind text not null default 'monthly'
    check (kind in ('monthly', 'health', 'baseline', 'quarterly')),
  title text not null,
  period_start date,
  period_end date,
  status text not null default 'draft' check (status in ('draft', 'published')),
  summary text not null default '',
  data jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_reports_client_idx
  on public.service_reports (client_id, period_end desc);

-- 8. Renewal & expansion roadmaps ---------------------------------------------

create table if not exists public.client_roadmaps (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  subscription_id uuid references public.client_subscriptions(id) on delete set null,
  title text not null,
  period_label text not null default '',
  status text not null default 'draft' check (status in (
    'draft', 'proposed', 'approved', 'in_progress', 'completed'
  )),
  summary text not null default '',
  items jsonb not null default '[]'::jsonb,
  estimated_impact text not null default '',
  proposed_timeline text not null default '',
  review_scheduled_for timestamptz,
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_roadmaps_client_idx
  on public.client_roadmaps (client_id, created_at desc);

-- 9. Proposals ------------------------------------------------------------------

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  title text not null,
  status text not null default 'draft' check (status in (
    'draft', 'sent', 'viewed', 'accepted', 'declined', 'expired'
  )),
  kind text not null check (kind in (
    'implementation', 'monthly_service', 'implementation_plus_monthly',
    'project_completion'
  )),
  summary text not null default '',
  prepared_for text not null default '',
  -- One-time implementation scope
  implementation jsonb not null default '{}'::jsonb,
  -- Recurring service scope
  plan_id uuid references public.managed_service_plans(id) on delete set null,
  alternative_plan_ids jsonb not null default '[]'::jsonb,
  billing_frequency text not null default 'monthly'
    check (billing_frequency in ('monthly', 'annual')),
  monthly_price_cents integer,
  annual_price_cents integer,
  setup_fee_cents integer not null default 0,
  included_support text not null default '',
  service_level text not null default '',
  minimum_commitment_months integer not null default 0,
  addons jsonb not null default '[]'::jsonb,
  contract_terms text not null default '',
  valid_until timestamptz,
  -- Lifecycle
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  accepted_scope jsonb,
  acceptance_name text not null default '',
  acceptance_email text not null default '',
  subscription_id uuid references public.client_subscriptions(id) on delete set null,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_client_idx
  on public.proposals (client_id, created_at desc);
create index if not exists proposals_status_idx
  on public.proposals (status, created_at desc);

-- 10. Client & lead extensions ---------------------------------------------------

alter table public.clients
  add column if not exists stripe_customer_id text;

-- Booking-funnel managed-service answers + auto/admin plan recommendation.
alter table public.leads
  add column if not exists service_plan_answers jsonb,
  add column if not exists recommended_plan text;

-- 11. Row-level security (service-role only, like every other table) -------------

alter table public.managed_service_plans enable row level security;
alter table public.client_subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.subscription_invoices enable row level security;
alter table public.service_requests enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.service_reports enable row level security;
alter table public.client_roadmaps enable row level security;
alter table public.proposals enable row level security;

-- 12. Seed the four standard plans ------------------------------------------------

insert into public.managed_service_plans (
  id, key, name, tagline, best_fit, description,
  monthly_price_cents, annual_discount_pct, setup_fee_cents, custom_pricing,
  included_hours, additional_hourly_rate_cents,
  support_level, response_time, minimum_commitment_months, cancellation_terms,
  features, detailed_scope, comparison,
  recommended, business_critical, tier_rank, sort_order
) values
(
  'd0000000-0000-4000-8000-000000000001',
  'maintain',
  'Maintain',
  'Keep your systems secure, updated, backed up, and working properly.',
  'Businesses that need their systems kept secure, functional, and reliable.',
  'Your website and systems stay fast, protected, and dependable — without you thinking about them.',
  39500, 10, 0, false,
  2, 13500,
  'Standard support', 'Response within 2 business days', 3,
  '30-day written notice after the initial commitment.',
  '["Website and application hosting","Automated backups","Software and dependency updates","Uptime monitoring","Basic security monitoring","Form and integration monitoring","Performance checks","Minor technical fixes","Monthly system health review","Standard support response time"]'::jsonb,
  '["Managed hosting for your website and business applications","Automated daily backups with restore capability","Software, plugin, and dependency updates applied and verified","24/7 uptime monitoring with alerting","Baseline security monitoring and patching","Monitoring of forms, booking flows, and connected integrations","Monthly performance checks (speed, availability, errors)","Minor technical fixes and corrections included","A monthly system health review delivered to your portal","Standard support with a 2-business-day response target"]'::jsonb,
  '{"hosting":"Included","backups":"Automated daily","updates":"Software & dependencies","monitoring":"Uptime, forms & integrations","security":"Baseline monitoring","reporting":"Monthly health review","conversion_improvements":false,"monthly_system_changes":false,"automation_development":false,"ai_improvements":false,"strategy_consulting":false,"private_ai_management":false,"knowledge_base_updates":false,"incident_response":"Standard","support_priority":"Standard — 2 business days"}'::jsonb,
  false, false, 1, 10
),
(
  'd0000000-0000-4000-8000-000000000002',
  'optimize',
  'Optimize',
  'Continuously improve how your systems perform, convert, and support your team.',
  'Established businesses that want their website, funnels, and workflows actively improved every month.',
  'Everything in Maintain, plus ongoing conversion, performance, and workflow improvements backed by monthly analytics.',
  89500, 10, 0, false,
  6, 12500,
  'Priority support', 'Response within 1 business day', 3,
  '30-day written notice after the initial commitment.',
  '["Everything in Maintain","Conversion-rate improvements","Website and funnel optimization","Monthly analytics reporting","CRM and workflow adjustments","Form and booking-flow improvements","Speed and usability improvements","Lead-tracking verification","Monthly system changes","Performance recommendations","Priority support"]'::jsonb,
  '["Full Maintain scope: hosting, backups, updates, monitoring, and fixes","Ongoing conversion-rate improvements across pages and funnels","Website and funnel optimization informed by real traffic data","A professional monthly analytics and performance report","CRM and workflow adjustments as your process evolves","Form and booking-flow improvements to reduce drop-off","Speed and usability improvements","Lead-tracking verification so attribution stays accurate","Monthly system changes included within your service hours","Prioritized performance recommendations each month","Priority support with a 1-business-day response target"]'::jsonb,
  '{"hosting":"Included","backups":"Automated daily","updates":"Software & dependencies","monitoring":"Uptime, funnels & lead tracking","security":"Baseline monitoring","reporting":"Monthly analytics report","conversion_improvements":true,"monthly_system_changes":"Included","automation_development":false,"ai_improvements":false,"strategy_consulting":false,"private_ai_management":false,"knowledge_base_updates":false,"incident_response":"Priority","support_priority":"Priority — 1 business day"}'::jsonb,
  true, false, 2, 20
),
(
  'd0000000-0000-4000-8000-000000000003',
  'scale',
  'Scale',
  'Expand your technology, automation, and growth systems as your business evolves.',
  'Growing businesses that want new automation, AI improvements, and strategic development every month.',
  'Everything in Optimize, plus active development: new automations, AI assistant improvements, integrations, and monthly strategy consulting.',
  179500, 10, 0, false,
  14, 11500,
  'High-priority support', 'Response same business day', 6,
  '30-day written notice after the initial commitment.',
  '["Everything in Optimize","New automation development","AI assistant improvements","Workflow expansion","Campaign-system development","Lead-nurturing improvements","Sales-pipeline optimization","Internal operational systems","New integrations","Monthly strategy consulting","Growth experiments","Quarterly technology roadmap","Higher-priority support"]'::jsonb,
  '["Full Optimize scope: maintenance, monitoring, and monthly improvements","New automation development scoped and shipped each month","AI assistant improvements, training, and knowledge updates","Workflow expansion across sales, operations, and delivery","Campaign-system development for launches and promotions","Lead-nurturing sequence improvements","Sales-pipeline optimization and reporting","Internal operational systems built as you grow","New integrations connected and monitored","A monthly strategy consulting session with your RSG consultant","Structured growth experiments with measured results","A quarterly technology roadmap reviewed and approved together","High-priority support with same-business-day response"]'::jsonb,
  '{"hosting":"Included","backups":"Automated daily","updates":"Software & dependencies","monitoring":"Full-stack monitoring","security":"Enhanced monitoring","reporting":"Monthly analytics + strategy report","conversion_improvements":true,"monthly_system_changes":"Expanded","automation_development":true,"ai_improvements":"AI assistant improvements","strategy_consulting":"Monthly","private_ai_management":false,"knowledge_base_updates":"With AI improvements","incident_response":"Priority","support_priority":"High priority — same business day"}'::jsonb,
  false, false, 3, 30
),
(
  'd0000000-0000-4000-8000-000000000004',
  'managed_infrastructure',
  'Managed Infrastructure',
  'Fully managed private AI, security, hosting, and infrastructure for business-critical systems.',
  'Organizations running private AI, sensitive data, advanced integrations, or business-critical infrastructure.',
  'RSG operates your private AI and infrastructure end to end — deployment, security, model management, testing, and priority incident response.',
  null, 0, 0, true,
  null, null,
  'Business-critical support', 'Priority incident response — 4 business hours', 6,
  '60-day written notice with a managed transition plan.',
  '["Private AI hosting","Private-cloud or local deployment management","Security monitoring","Model management","AI performance monitoring","Knowledge-base updates","Permission and access management","Audit-log review","Backup and recovery management","Infrastructure monitoring","Vendor and API monitoring","Prompt-injection and data-leakage testing","Human-approval controls for sensitive AI actions","Priority incident response","Priority technical support","Regular infrastructure reviews"]'::jsonb,
  '["Private AI hosting on infrastructure you control","Private-cloud or fully local deployment management","Continuous security monitoring and hardening","Model management: versioning, evaluation, and upgrades","AI performance monitoring with quality benchmarks","Knowledge-base updates so answers stay accurate","Permission and access management across your team","Regular audit-log review with findings reported","Backup and recovery management, tested restores included","Infrastructure monitoring across servers, storage, and network","Vendor and API monitoring for every connected service","Scheduled prompt-injection and data-leakage testing","Human-approval controls for sensitive AI actions","Priority incident response within 4 business hours","Priority technical support for your whole team","Regular infrastructure reviews with your RSG engineer"]'::jsonb,
  '{"hosting":"Private / dedicated infrastructure","backups":"Managed backup & recovery","updates":"Full stack, including models","monitoring":"Infrastructure, vendor & API","security":"Continuous + AI security testing","reporting":"Full infrastructure reporting","conversion_improvements":"Where applicable","monthly_system_changes":"Included","automation_development":"Scoped per agreement","ai_improvements":"Full model & AI management","strategy_consulting":"Regular infrastructure reviews","private_ai_management":true,"knowledge_base_updates":"Included","incident_response":"Priority — 4 business hours","support_priority":"Business-critical"}'::jsonb,
  false, true, 4, 40
)
on conflict (key) do nothing;
