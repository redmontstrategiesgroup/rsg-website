-- ---------------------------------------------------------------------------
-- Client Lifecycle Platform (July 2026)
--
-- One connected journey: qualification → assessment → booking → preparation
-- questionnaire → proposal → contract → deposit → portal activation →
-- project delivery → training → support → reporting → renewal/expansion.
--
-- Conventions (match the rest of the platform):
--   * RLS enabled on every table, NO policies — service-role access only.
--   * Money in integer cents. Statuses are text + CHECK. Dates timestamptz.
--   * Presentation content may be jsonb; workflow-critical facts are columns.
-- ---------------------------------------------------------------------------

-- =====================================================================
-- 0. Extend existing tables
-- =====================================================================

-- Leads: qualification-form fields + service category routing.
alter table public.leads
  add column if not exists service_area text,
  add column if not exists revenue_range text,
  add column if not exists budget_range text,
  add column if not exists desired_outcome text,
  add column if not exists current_systems text,
  add column if not exists heard_about text,
  add column if not exists service_category text;

-- Widen the status CHECK to the full LeadStatus union used by the app
-- (fixes a pre-existing drift between lib/types.ts and the constraint).
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads
  add constraint leads_status_check
  check (status in (
    'new','contacted','qualified','meeting_scheduled','won','lost','spam',
    'archived','intake_started','intake_abandoned','submitted',
    'qualified_not_booked','appointment_booked','manual_review','not_eligible',
    'rescheduled','cancelled','no_show','completed','follow_up_required',
    'converted','closed'
  ));

-- Clients: lifecycle status, contact profile, goals/baseline for reporting.
alter table public.clients
  add column if not exists status text not null default 'active',
  add column if not exists lead_id uuid,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists industry text,
  add column if not exists timezone text not null default 'America/New_York',
  add column if not exists stripe_customer_id text,
  add column if not exists success_goals jsonb not null default '[]'::jsonb,
  add column if not exists baseline jsonb not null default '{}'::jsonb,
  add column if not exists portal_activated_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_status_check') then
    alter table public.clients
      add constraint clients_status_check
      check (status in ('prospect','onboarding','active','paused','support','former'));
  end if;
end $$;

-- =====================================================================
-- 1. Client team members (multi-user portal access, role-based)
-- =====================================================================

create table if not exists public.client_users (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  email text not null,
  name text not null,
  title text,
  password_hash text,
  role text not null default 'member'
    check (role in ('owner','admin','member')),
  invite_token text,
  invite_expires_at timestamptz,
  invited_by text,
  last_login_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_users_email_lower_idx
  on public.client_users (lower(email));
create index if not exists client_users_client_id_idx on public.client_users (client_id);
create unique index if not exists client_users_invite_token_idx
  on public.client_users (invite_token) where invite_token is not null;

-- =====================================================================
-- 2. Business systems assessment
-- =====================================================================

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  email text not null default '',
  token text not null,
  status text not null default 'draft'
    check (status in ('draft','in_progress','submitted','reviewed','expired')),
  current_section text,
  invited_emails jsonb not null default '[]'::jsonb,
  score integer,
  recommended_service_category text,
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists assessments_token_idx on public.assessments (token);
create index if not exists assessments_lead_id_idx on public.assessments (lead_id);
create index if not exists assessments_status_idx on public.assessments (status);

create table if not exists public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  section_key text not null,
  question_key text not null,
  answer jsonb not null default 'null'::jsonb,
  answered_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, question_key)
);

create index if not exists assessment_responses_assessment_idx
  on public.assessment_responses (assessment_id);

-- =====================================================================
-- 3. Preparation questionnaires (post-booking)
-- =====================================================================

create table if not exists public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  token text not null,
  template_key text not null default 'general',
  status text not null default 'pending'
    check (status in ('pending','in_progress','submitted','waived','expired')),
  invited_emails jsonb not null default '[]'::jsonb,
  due_at timestamptz,
  submitted_at timestamptz,
  reminder_count integer not null default 0,
  last_reminded_at timestamptz,
  brief jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists questionnaires_token_idx on public.questionnaires (token);
create index if not exists questionnaires_booking_idx on public.questionnaires (booking_id);
create index if not exists questionnaires_status_idx on public.questionnaires (status);

create table if not exists public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.questionnaires(id) on delete cascade,
  question_key text not null,
  answer jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  unique (questionnaire_id, question_key)
);

create index if not exists questionnaire_responses_qidx
  on public.questionnaire_responses (questionnaire_id);

-- =====================================================================
-- 4. Sales opportunities (the journey spine)
-- =====================================================================

create table if not exists public.sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  assessment_id uuid references public.assessments(id) on delete set null,
  name text not null,
  service_category text not null default '',
  stage text not null default 'qualification'
    check (stage in (
      'qualification','assessment','consultation_scheduled','preparation',
      'consultation_held','internal_review','proposal','contract','deposit',
      'won','lost','dormant'
    )),
  value_cents integer,
  currency text not null default 'usd',
  owner_admin_id text,
  next_action text,
  next_action_due timestamptz,
  next_action_party text not null default 'rsg'
    check (next_action_party in ('rsg','client','joint')),
  consultation_notes text not null default '',
  internal_review jsonb not null default '{}'::jsonb,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_opportunities_stage_idx on public.sales_opportunities (stage);
create index if not exists sales_opportunities_lead_idx on public.sales_opportunities (lead_id);
create index if not exists sales_opportunities_client_idx on public.sales_opportunities (client_id);

-- =====================================================================
-- 5. Proposals
-- =====================================================================

create table if not exists public.lifecycle_proposals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.sales_opportunities(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  token text not null,
  title text not null,
  status text not null default 'draft'
    check (status in (
      'draft','sent','viewed','revision_requested','approved','expired','withdrawn'
    )),
  version integer not null default 1,
  currency text not null default 'usd',
  total_cents integer not null default 0,
  deposit_cents integer not null default 0,
  payment_schedule jsonb not null default '[]'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  created_from_template_key text,
  expires_at timestamptz,
  sent_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  total_view_seconds integer not null default 0,
  approved_at timestamptz,
  approved_by_name text,
  approved_ip text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lifecycle_proposals_token_idx on public.lifecycle_proposals (token);
create index if not exists lifecycle_proposals_status_idx on public.lifecycle_proposals (status);
create index if not exists lifecycle_proposals_opportunity_idx on public.lifecycle_proposals (opportunity_id);

create table if not exists public.proposal_options (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.lifecycle_proposals(id) on delete cascade,
  title text not null,
  description text not null default '',
  price_cents integer not null default 0,
  billing text not null default 'one_time'
    check (billing in ('one_time','monthly','quarterly','annual')),
  selected boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists proposal_options_proposal_idx
  on public.proposal_options (proposal_id);

create table if not exists public.proposal_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.lifecycle_proposals(id) on delete cascade,
  event text not null
    check (event in (
      'sent','opened','section_viewed','view_heartbeat','option_selected',
      'option_deselected','comment_added','revision_requested','approved',
      'expired','withdrawn','reminder_sent'
    )),
  section_key text,
  actor text not null default 'client' check (actor in ('client','admin','system')),
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists proposal_events_proposal_idx
  on public.proposal_events (proposal_id, created_at desc);

create table if not exists public.proposal_comments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.lifecycle_proposals(id) on delete cascade,
  author_type text not null check (author_type in ('client','admin')),
  author_name text not null default '',
  section_key text,
  body text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists proposal_comments_proposal_idx
  on public.proposal_comments (proposal_id);

-- =====================================================================
-- 6. Contracts and electronic signatures
-- =====================================================================

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.sales_opportunities(id) on delete set null,
  proposal_id uuid references public.lifecycle_proposals(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  token text not null,
  kind text not null default 'project'
    check (kind in (
      'msa','project','sow','maintenance','subscription','nda','dpa','change_order'
    )),
  title text not null,
  status text not null default 'draft'
    check (status in (
      'draft','sent','viewed','partially_signed','signed','countersigned',
      'active','declined','voided','expired'
    )),
  version integer not null default 1,
  content jsonb not null default '[]'::jsonb,
  content_hash text not null default '',
  requires_countersign boolean not null default true,
  effective_date date,
  renewal_date date,
  expires_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contracts_token_idx on public.contracts (token);
create index if not exists contracts_status_idx on public.contracts (status);
create index if not exists contracts_client_idx on public.contracts (client_id);

create table if not exists public.contract_signatures (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  signer_type text not null check (signer_type in ('client','admin')),
  role text not null default 'signer' check (role in ('signer','countersigner')),
  signer_name text not null default '',
  signer_email text not null default '',
  signer_title text,
  signed_name text,
  initials text,
  acknowledgments jsonb not null default '[]'::jsonb,
  content_hash text,
  ip text,
  user_agent text,
  sort_order integer not null default 0,
  required boolean not null default true,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contract_signatures_contract_idx
  on public.contract_signatures (contract_id);

create table if not exists public.contract_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  event text not null,
  actor_type text not null default 'system' check (actor_type in ('client','admin','system')),
  actor_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists contract_events_contract_idx
  on public.contract_events (contract_id, created_at desc);

-- =====================================================================
-- 7. Invoices and payments (Stripe-hosted or recorded manual/ACH)
-- =====================================================================

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number bigint generated by default as identity,
  client_id uuid references public.clients(id) on delete set null,
  opportunity_id uuid references public.sales_opportunities(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  project_id uuid,
  token text not null,
  kind text not null default 'deposit'
    check (kind in ('deposit','milestone','subscription','final','support','other')),
  status text not null default 'open'
    check (status in ('draft','open','processing','paid','void','uncollectible','refunded')),
  currency text not null default 'usd',
  description text not null default '',
  line_items jsonb not null default '[]'::jsonb,
  subtotal_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  amount_paid_cents integer not null default 0,
  due_at timestamptz,
  paid_at timestamptz,
  reminder_count integer not null default 0,
  last_reminded_at timestamptz,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists invoices_token_idx on public.invoices (token);
create unique index if not exists invoices_number_idx on public.invoices (number);
create index if not exists invoices_client_idx on public.invoices (client_id);
create index if not exists invoices_status_idx on public.invoices (status);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  provider text not null default 'manual'
    check (provider in ('stripe','manual','ach','check','other')),
  provider_ref text,
  status text not null default 'pending'
    check (status in ('pending','processing','succeeded','failed','refunded','partially_refunded')),
  amount_cents integer not null default 0,
  currency text not null default 'usd',
  method_summary text,
  failure_reason text,
  refunded_cents integer not null default 0,
  received_at timestamptz,
  recorded_by text,
  created_at timestamptz not null default now()
);

create index if not exists payments_invoice_idx on public.payments (invoice_id);
create index if not exists payments_client_idx on public.payments (client_id);
create unique index if not exists payments_provider_ref_idx
  on public.payments (provider, provider_ref) where provider_ref is not null;

-- =====================================================================
-- 8. Projects, milestones, tasks
-- =====================================================================

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  opportunity_id uuid references public.sales_opportunities(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  code text not null default '',
  name text not null,
  summary text not null default '',
  status text not null default 'onboarding'
    check (status in (
      'onboarding','active','paused','client_review','launched','support',
      'completed','archived'
    )),
  health text not null default 'on_track'
    check (health in ('on_track','at_risk','delayed')),
  current_phase text not null default 'Discovery',
  progress integer not null default 0,
  start_date date,
  target_launch_date date,
  actual_launch_date date,
  manager_admin_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_client_idx on public.projects (client_id);
create index if not exists projects_status_idx on public.projects (status);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_project_fk') then
    alter table public.invoices
      add constraint invoices_project_fk
      foreign key (project_id) references public.projects(id) on delete set null;
  end if;
end $$;

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  member_type text not null check (member_type in ('admin','client_user')),
  admin_id text,
  client_user_id uuid references public.client_users(id) on delete cascade,
  project_role text not null default 'viewer'
    check (project_role in (
      'manager','developer','support','finance','viewer',
      'client_owner','client_admin','client_member'
    )),
  created_at timestamptz not null default now()
);

create index if not exists project_members_project_idx on public.project_members (project_id);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text not null default '',
  owner_party text not null default 'rsg'
    check (owner_party in ('rsg','client','joint')),
  owner_admin_id text,
  sort_order integer not null default 0,
  status text not null default 'not_started'
    check (status in (
      'not_started','upcoming','in_progress','waiting_on_client','under_review',
      'changes_requested','approved','completed','delayed','blocked'
    )),
  starts_on date,
  target_date date,
  completed_on date,
  depends_on uuid references public.milestones(id) on delete set null,
  deliverables jsonb not null default '[]'::jsonb,
  client_action text,
  approval_required boolean not null default false,
  approved_at timestamptz,
  approved_by text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists milestones_project_idx on public.milestones (project_id, sort_order);
create index if not exists milestones_status_idx on public.milestones (status);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  title text not null,
  description text not null default '',
  kind text not null default 'general'
    check (kind in ('general','onboarding','file_request','approval','training','access')),
  assignee_party text not null default 'rsg'
    check (assignee_party in ('rsg','client')),
  assignee_admin_id text,
  assignee_client_user_id uuid references public.client_users(id) on delete set null,
  status text not null default 'open'
    check (status in ('open','in_progress','waiting','done','cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_tasks_project_idx on public.project_tasks (project_id);
create index if not exists project_tasks_status_idx on public.project_tasks (status);

-- =====================================================================
-- 9. Requests, messages, files, approvals (project workspace)
-- =====================================================================

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  number bigint generated by default as identity,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  milestone_id uuid references public.milestones(id) on delete set null,
  requester_type text not null default 'client' check (requester_type in ('client','admin')),
  requester_client_user_id uuid references public.client_users(id) on delete set null,
  requester_name text not null default '',
  category text not null default 'question'
    check (category in (
      'question','content','design_revision','technical_change','new_feature',
      'access_credentials','billing','support','scope_change'
    )),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  title text not null,
  description text not null default '',
  status text not null default 'open'
    check (status in (
      'open','in_review','in_progress','waiting_on_client','needs_change_order',
      'resolved','closed'
    )),
  assigned_admin_id text,
  due_at timestamptz,
  resolution text,
  resolved_at timestamptz,
  change_order_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists requests_client_idx on public.requests (client_id);
create index if not exists requests_status_idx on public.requests (status);
create index if not exists requests_project_idx on public.requests (project_id);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated by default as identity,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  category text not null default 'bug'
    check (category in (
      'outage','bug','access','integration','automation','data_reporting',
      'website_update','training','feature','billing','security'
    )),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent','critical')),
  subject text not null,
  description text not null default '',
  status text not null default 'submitted'
    check (status in (
      'submitted','acknowledged','in_review','waiting_on_client','in_progress',
      'escalated','resolved','closed'
    )),
  opened_by_client_user_id uuid references public.client_users(id) on delete set null,
  opened_by_name text not null default '',
  assigned_admin_id text,
  target_response_minutes integer,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  resolution_notes text,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_client_idx on public.tickets (client_id);
create index if not exists tickets_status_idx on public.tickets (status);
create unique index if not exists tickets_number_idx on public.tickets (number);

-- Unified message threads: project messages, request threads, ticket threads.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  request_id uuid references public.requests(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete cascade,
  author_type text not null check (author_type in ('client','admin','system')),
  author_client_user_id uuid references public.client_users(id) on delete set null,
  author_admin_id text,
  author_name text not null default '',
  body text not null,
  internal boolean not null default false,
  mentions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists messages_client_idx on public.messages (client_id, created_at desc);
create index if not exists messages_project_idx on public.messages (project_id, created_at desc);
create index if not exists messages_request_idx on public.messages (request_id, created_at);
create index if not exists messages_ticket_idx on public.messages (ticket_id, created_at);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  milestone_id uuid references public.milestones(id) on delete set null,
  request_id uuid references public.requests(id) on delete set null,
  ticket_id uuid references public.tickets(id) on delete set null,
  questionnaire_id uuid references public.questionnaires(id) on delete set null,
  assessment_id uuid references public.assessments(id) on delete set null,
  uploaded_by_type text not null default 'client'
    check (uploaded_by_type in ('client','admin','system','prospect')),
  uploaded_by_id text,
  uploaded_by_name text not null default '',
  name text not null,
  description text not null default '',
  category text not null default 'document'
    check (category in ('brand','content','document','contract','report','deliverable','training','other')),
  storage_path text not null,
  size_bytes bigint not null default 0,
  mime_type text not null default 'application/octet-stream',
  current_version integer not null default 1,
  scan_status text not null default 'pending'
    check (scan_status in ('pending','clean','flagged','skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists files_client_idx on public.files (client_id, created_at desc);
create index if not exists files_project_idx on public.files (project_id);

create table if not exists public.file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  version integer not null,
  storage_path text not null,
  size_bytes bigint not null default 0,
  uploaded_by_type text not null default 'client',
  uploaded_by_name text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (file_id, version)
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  milestone_id uuid references public.milestones(id) on delete set null,
  file_id uuid references public.files(id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'pending'
    check (status in ('pending','approved','changes_requested','cancelled')),
  requested_by text,
  due_at timestamptz,
  decided_at timestamptz,
  decided_by_client_user_id uuid references public.client_users(id) on delete set null,
  decided_by_name text,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approvals_client_idx on public.approvals (client_id);
create index if not exists approvals_status_idx on public.approvals (status);

-- =====================================================================
-- 10. Training library
-- =====================================================================

create table if not exists public.training_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  kind text not null default 'guide'
    check (kind in ('video','guide','walkthrough','faq','download','recording','doc')),
  system_tag text not null default '',
  topic text not null default '',
  difficulty text not null default 'beginner'
    check (difficulty in ('beginner','intermediate','advanced')),
  audience_role text not null default 'all'
    check (audience_role in ('all','owner','admin','member')),
  url text,
  storage_path text,
  body text not null default '',
  duration_minutes integer,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  training_item_id uuid not null references public.training_items(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  client_user_id uuid references public.client_users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  required boolean not null default false,
  due_at timestamptz,
  assigned_by text,
  created_at timestamptz not null default now()
);

create unique index if not exists training_assignments_unique_idx
  on public.training_assignments (training_item_id, client_id, coalesce(client_user_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists training_assignments_client_idx
  on public.training_assignments (client_id);

create table if not exists public.training_completions (
  id uuid primary key default gen_random_uuid(),
  training_item_id uuid not null references public.training_items(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  client_user_id uuid references public.client_users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (training_item_id, client_user_id)
);

-- =====================================================================
-- 11. SLA policies (support targets — nothing promised until enabled)
-- =====================================================================

create table if not exists public.sla_policies (
  id uuid primary key default gen_random_uuid(),
  priority text not null unique
    check (priority in ('low','normal','high','urgent','critical')),
  target_response_minutes integer not null,
  target_resolution_minutes integer not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.sla_policies (priority, target_response_minutes, target_resolution_minutes, enabled) values
  ('low',      1440, 10080, false),
  ('normal',    480,  4320, false),
  ('high',      240,  1440, false),
  ('urgent',     60,   480, false),
  ('critical',   30,   240, false)
on conflict (priority) do nothing;

-- =====================================================================
-- 12. Reporting: metrics + monthly reports
-- =====================================================================

create table if not exists public.metrics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  period_month date not null,
  key text not null,
  label text not null,
  value numeric not null,
  unit text not null default '',
  goal numeric,
  baseline numeric,
  source text not null default 'manual'
    check (source in ('measured','estimated','manual')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, key, period_month)
);

create index if not exists metrics_client_period_idx
  on public.metrics (client_id, period_month desc);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  token text not null,
  period_month date not null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft','published')),
  executive_summary text not null default '',
  key_wins jsonb not null default '[]'::jsonb,
  scorecard jsonb not null default '[]'::jsonb,
  goal_progress jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  next_priorities jsonb not null default '[]'::jsonb,
  expansion_notes text not null default '',
  published_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, period_month)
);

create unique index if not exists reports_token_idx on public.reports (token);
create index if not exists reports_client_idx on public.reports (client_id, period_month desc);

-- =====================================================================
-- 13. Renewals and expansion roadmap
-- =====================================================================

create table if not exists public.renewals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  kind text not null default 'contract'
    check (kind in ('contract','subscription','support_plan','review_meeting')),
  name text not null,
  renews_on date not null,
  term text not null default '',
  value_cents integer,
  status text not null default 'upcoming'
    check (status in ('upcoming','notice_sent','in_discussion','renewed','lapsed','cancelled')),
  reminder_days jsonb not null default '[60,30,14]'::jsonb,
  last_reminded_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists renewals_client_idx on public.renewals (client_id);
create index if not exists renewals_renews_on_idx on public.renewals (renews_on);

create table if not exists public.expansion_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  problem text not null default '',
  solution text not null default '',
  expected_outcome text not null default '',
  priority text not null default 'medium'
    check (priority in ('low','medium','high')),
  timing text not null default '',
  dependencies text not null default '',
  investment_range text not null default '',
  status text not null default 'identified'
    check (status in (
      'identified','recommended','discussing','planned','proposed','approved',
      'in_progress','completed','not_needed'
    )),
  source text not null default 'manual'
    check (source in ('manual','report','support','assessment','project')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expansion_items_client_idx on public.expansion_items (client_id);

-- =====================================================================
-- 14. Notifications, automations, activity
-- =====================================================================

create table if not exists public.lifecycle_notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('client','admin')),
  client_id uuid references public.clients(id) on delete cascade,
  client_user_id uuid references public.client_users(id) on delete cascade,
  admin_id text,
  kind text not null default 'info',
  title text not null,
  body text not null default '',
  href text,
  read_at timestamptz,
  email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists lifecycle_notifications_client_idx
  on public.lifecycle_notifications (client_id, created_at desc);
create index if not exists lifecycle_notifications_admin_idx
  on public.lifecycle_notifications (audience, created_at desc);

create table if not exists public.automation_settings (
  id text primary key,
  enabled boolean not null default true,
  delay_minutes integer not null default 0,
  channel text not null default 'both'
    check (channel in ('email','in_app','both','none')),
  conditions jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_key text not null,
  dedupe_key text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  status text not null default 'pending'
    check (status in ('pending','completed','failed','skipped')),
  scheduled_for timestamptz not null default now(),
  executed_at timestamptz,
  attempts integer not null default 0,
  error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists automation_runs_dedupe_idx
  on public.automation_runs (dedupe_key);
create index if not exists automation_runs_due_idx
  on public.automation_runs (scheduled_for) where status = 'pending';

create table if not exists public.client_activity (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  actor_type text not null default 'system'
    check (actor_type in ('client','admin','system','prospect')),
  actor_name text not null default '',
  action text not null,
  entity_type text,
  entity_id text,
  visible_to_client boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_activity_client_idx
  on public.client_activity (client_id, created_at desc);

-- =====================================================================
-- 15. Lock everything down (RLS on, service-role only)
-- =====================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'client_users','assessments','assessment_responses','questionnaires',
    'questionnaire_responses','sales_opportunities','lifecycle_proposals',
    'proposal_options','proposal_events','proposal_comments','contracts',
    'contract_signatures','contract_events','invoices','payments','projects',
    'project_members','milestones','project_tasks','requests','tickets',
    'messages','files','file_versions','approvals','training_items',
    'training_assignments','training_completions','sla_policies','metrics',
    'reports','renewals','expansion_items','lifecycle_notifications',
    'automation_settings','automation_runs','client_activity'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

-- =====================================================================
-- 16. Private storage bucket for client files (signed URLs only)
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('rsg-files', 'rsg-files', false)
on conflict (id) do nothing;

-- =====================================================================
-- 17. Seed: consultation appointment types
-- =====================================================================
-- New types are is_public = false so the simplified public funnel is
-- unchanged; the lifecycle flows deep-link them by slug or the admin books
-- them internally. Flip is_public in Admin → Scheduling to expose any.

insert into public.appointment_types
  (id, name, internal_name, slug, public_description, duration_minutes,
   buffer_after_minutes, min_notice_minutes, confirmation_message, is_public, active)
values
  ('d0000000-0000-4000-8000-000000000001',
   'Business Systems Consultation', 'Lifecycle: business systems', 'business-systems-consultation',
   'A focused conversation about how your business runs today and where better systems would have the most impact.',
   45, 15, 1440,
   'Your Business Systems Consultation is booked. We''ll come prepared with notes on everything you''ve shared so far.',
   false, true),
  ('d0000000-0000-4000-8000-000000000002',
   'Growth Systems Consultation', 'Lifecycle: growth systems', 'growth-systems-consultation',
   'For businesses focused on lead flow, follow-up, and converting more of the demand they already have.',
   45, 15, 1440,
   'Your Growth Systems Consultation is booked. We''ll review your goals and current lead flow before the call.',
   false, true),
  ('d0000000-0000-4000-8000-000000000003',
   'Operations Systems Consultation', 'Lifecycle: operations systems', 'operations-systems-consultation',
   'For businesses whose day-to-day scheduling, quoting, invoicing, or internal communication needs to run smoother.',
   45, 15, 1440,
   'Your Operations Systems Consultation is booked. We''ll review your current workflow notes before the call.',
   false, true),
  ('d0000000-0000-4000-8000-000000000004',
   'Private AI Consultation', 'Lifecycle: private AI', 'private-ai-consultation',
   'A deeper conversation about private, secure AI systems built around your data and requirements.',
   60, 15, 1440,
   'Your Private AI Consultation is booked. We''ll review your requirements and privacy considerations in advance.',
   false, true),
  ('d0000000-0000-4000-8000-000000000005',
   'Existing Client Strategy Call', 'Lifecycle: client strategy', 'client-strategy-call',
   'A working session for current clients: progress, priorities, and what comes next.',
   45, 15, 720,
   'Your strategy call is booked. We''ll bring your latest project status and performance data.',
   false, true),
  ('d0000000-0000-4000-8000-000000000006',
   'Technical Support Session', 'Lifecycle: support session', 'technical-support-session',
   'A screen-share session to resolve a specific technical issue or question.',
   30, 10, 240,
   'Your support session is booked. Please have the affected system open and ready to share.',
   false, true)
on conflict (id) do nothing;

-- =====================================================================
-- 18. Seed: default automation settings
-- =====================================================================

insert into public.automation_settings (id, enabled, delay_minutes, channel) values
  ('qualification_confirmation',      true,    0, 'email'),
  ('lead_assignment',                 true,    0, 'in_app'),
  ('assessment_invite',               true,    0, 'email'),
  ('assessment_reminder',             true, 2880, 'email'),
  ('assessment_complete_internal',    true,    0, 'both'),
  ('booking_confirmation',            true,    0, 'email'),
  ('questionnaire_invite',            true,   10, 'email'),
  ('questionnaire_reminder',          true, 2880, 'email'),
  ('prep_brief_internal',             true,    0, 'both'),
  ('proposal_delivery',               true,    0, 'email'),
  ('proposal_follow_up',              true, 4320, 'email'),
  ('proposal_expiring',               true,    0, 'email'),
  ('contract_delivery',               true,    0, 'email'),
  ('signature_reminder',              true, 2880, 'email'),
  ('contract_signed_internal',        true,    0, 'both'),
  ('deposit_request',                 true,    0, 'email'),
  ('payment_receipt',                 true,    0, 'email'),
  ('payment_failed',                  true,    0, 'both'),
  ('payment_reminder',                true, 4320, 'email'),
  ('portal_activation',               true,    0, 'email'),
  ('onboarding_task_reminder',        true, 2880, 'email'),
  ('missing_file_reminder',           true, 4320, 'email'),
  ('milestone_update',                true,    0, 'both'),
  ('approval_request',                true,    0, 'both'),
  ('project_delay_notice',            true,    0, 'both'),
  ('training_assigned',               true,    0, 'both'),
  ('ticket_created',                  true,    0, 'both'),
  ('ticket_updated',                  true,    0, 'both'),
  ('ticket_resolved',                 true,    0, 'email'),
  ('ticket_inactive_nudge',           true, 4320, 'email'),
  ('report_published',                true,    0, 'both'),
  ('renewal_reminder',                true,    0, 'both'),
  ('strategy_review_reminder',        true,    0, 'email'),
  ('expansion_roadmap_update',        true,    0, 'in_app')
on conflict (id) do nothing;

-- =====================================================================
-- 19. Seed: lifecycle notification templates
-- =====================================================================

insert into public.notification_templates (key, name, subject, body_html, body_text, audience) values
  ('lc_qualification_confirmation', 'Lifecycle: qualification received',
   'We received your information — Redmont Strategies Group',
   '<p>Hi {{first_name}},</p><p>Thank you for telling us about {{business_name}}. Our team is reviewing what you shared.</p><p>{{next_step_line}}</p><p>You can move forward right away here:<br/><a href="{{next_step_url}}">{{next_step_label}}</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, thanks for telling us about {{business_name}}. Next step: {{next_step_label}} — {{next_step_url}}',
   'visitor'),
  ('lc_assessment_invite', 'Lifecycle: assessment invite',
   'Your Business Systems Assessment — Redmont Strategies Group',
   '<p>Hi {{first_name}},</p><p>Your Business Systems Assessment is ready. It takes about 10–15 minutes, saves as you go, and gives us a clear picture of how {{business_name}} runs today.</p><p><a href="{{assessment_url}}">Start your assessment</a></p><p>You can invite a teammate to contribute from inside the assessment.</p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, your Business Systems Assessment is ready (10–15 minutes, progress saves automatically): {{assessment_url}}',
   'visitor'),
  ('lc_assessment_reminder', 'Lifecycle: assessment reminder',
   'Your assessment is waiting — Redmont Strategies Group',
   '<p>Hi {{first_name}},</p><p>Your Business Systems Assessment for {{business_name}} is saved right where you left it.</p><p><a href="{{assessment_url}}">Pick up where you left off</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, your assessment is saved where you left it: {{assessment_url}}',
   'visitor'),
  ('lc_assessment_complete_internal', 'Lifecycle: assessment completed (internal)',
   'Assessment completed — {{business_name}}',
   '<p>{{full_name}} ({{business_name}}) completed the Business Systems Assessment.</p><ul><li>Score: {{score}}</li><li>Recommended: {{recommended_category}}</li><li>Email: {{email}}</li></ul><p><a href="{{admin_url}}">Review in Client OS</a></p>',
   'Assessment completed: {{full_name}} / {{business_name}} — score {{score}}, recommended {{recommended_category}}. {{admin_url}}',
   'internal'),
  ('lc_questionnaire_invite', 'Lifecycle: preparation questionnaire',
   'Before your consultation — a few things that help us prepare',
   '<p>Hi {{first_name}},</p><p>To make your consultation on {{appointment_time_local}} as useful as possible, we''ve prepared a short questionnaire. Your answers save automatically and you can skip anything that doesn''t apply.</p><p><a href="{{questionnaire_url}}">Open the preparation questionnaire</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, to prepare for your consultation on {{appointment_time_local}}: {{questionnaire_url}}',
   'visitor'),
  ('lc_questionnaire_reminder', 'Lifecycle: questionnaire reminder',
   'A quick nudge before your consultation',
   '<p>Hi {{first_name}},</p><p>Your consultation is coming up on {{appointment_time_local}}. Completing the short preparation questionnaire means we spend your call on recommendations instead of basics.</p><p><a href="{{questionnaire_url}}">Finish the questionnaire</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, your consultation is {{appointment_time_local}}. Finish the questionnaire: {{questionnaire_url}}',
   'visitor'),
  ('lc_prep_brief_internal', 'Lifecycle: prep brief (internal)',
   'Prep brief ready — {{business_name}} ({{appointment_time_admin}})',
   '<p>The preparation brief for {{full_name}} ({{business_name}}) is ready.</p><p><a href="{{admin_url}}">Open the consultation brief</a></p>',
   'Prep brief ready for {{business_name}} ({{appointment_time_admin}}): {{admin_url}}',
   'internal'),
  ('lc_proposal_delivery', 'Lifecycle: proposal delivery',
   'Your proposal from Redmont Strategies Group',
   '<p>Hi {{first_name}},</p><p>Your proposal — <strong>{{proposal_title}}</strong> — is ready to review.</p><p><a href="{{proposal_url}}">Review your proposal</a></p><p>You can leave questions on any section, adjust optional services, and approve online. This proposal is valid until {{expires_on}}.</p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, your proposal "{{proposal_title}}" is ready: {{proposal_url}} (valid until {{expires_on}})',
   'visitor'),
  ('lc_proposal_follow_up', 'Lifecycle: proposal follow-up',
   'Any questions on your proposal?',
   '<p>Hi {{first_name}},</p><p>Just checking in on the proposal we sent for {{business_name}}. If anything is unclear, you can leave a comment directly on any section and we''ll respond quickly.</p><p><a href="{{proposal_url}}">Revisit your proposal</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, checking in on your proposal: {{proposal_url}}',
   'visitor'),
  ('lc_proposal_expiring', 'Lifecycle: proposal expiring',
   'Your proposal expires soon',
   '<p>Hi {{first_name}},</p><p>A quick note that your proposal — {{proposal_title}} — expires on {{expires_on}}. After that date, pricing and timelines may need to be re-confirmed.</p><p><a href="{{proposal_url}}">Review your proposal</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, your proposal expires {{expires_on}}: {{proposal_url}}',
   'visitor'),
  ('lc_proposal_approved_internal', 'Lifecycle: proposal approved (internal)',
   'Proposal approved — {{business_name}}',
   '<p>{{approver_name}} approved <strong>{{proposal_title}}</strong> for {{business_name}}.</p><p>Total: {{total}} · Deposit: {{deposit}}</p><p><a href="{{admin_url}}">Open in Client OS</a></p>',
   'Proposal approved: {{proposal_title}} ({{business_name}}). Total {{total}}, deposit {{deposit}}. {{admin_url}}',
   'internal'),
  ('lc_contract_delivery', 'Lifecycle: contract delivery',
   'Your agreement is ready to sign',
   '<p>Hi {{first_name}},</p><p>Your agreement — <strong>{{contract_title}}</strong> — is ready for electronic signature.</p><p><a href="{{contract_url}}">Review and sign</a></p><p>Signing takes about two minutes. You''ll receive a completed copy for your records once all signatures are in place.</p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, your agreement "{{contract_title}}" is ready to sign: {{contract_url}}',
   'visitor'),
  ('lc_signature_reminder', 'Lifecycle: signature reminder',
   'Reminder: your agreement is awaiting signature',
   '<p>Hi {{first_name}},</p><p>Your agreement — {{contract_title}} — is still awaiting your signature.</p><p><a href="{{contract_url}}">Review and sign</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, your agreement is awaiting signature: {{contract_url}}',
   'visitor'),
  ('lc_contract_signed', 'Lifecycle: contract fully signed',
   'Your signed agreement — Redmont Strategies Group',
   '<p>Hi {{first_name}},</p><p><strong>{{contract_title}}</strong> is now fully signed. You can view and download your copy any time:</p><p><a href="{{contract_url}}">View your signed agreement</a></p><p>Next step: {{next_step_line}}</p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, {{contract_title}} is fully signed. Your copy: {{contract_url}}. Next: {{next_step_line}}',
   'visitor'),
  ('lc_deposit_request', 'Lifecycle: deposit request',
   'Your project deposit — Redmont Strategies Group',
   '<p>Hi {{first_name}},</p><p>To reserve your project start, the deposit of <strong>{{amount}}</strong> is now due.</p><p><a href="{{pay_url}}">Pay securely online</a></p><p>Total investment: {{total}} · Deposit due now: {{amount}} · Remaining balance follows the payment schedule in your proposal.</p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, your deposit of {{amount}} is due: {{pay_url}}',
   'visitor'),
  ('lc_payment_receipt', 'Lifecycle: payment receipt',
   'Receipt — {{amount}} received',
   '<p>Hi {{first_name}},</p><p>We''ve received your payment of <strong>{{amount}}</strong> ({{description}}). A record is available in your client portal.</p><p>{{next_step_line}}</p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, we received your payment of {{amount}} ({{description}}). {{next_step_line}}',
   'visitor'),
  ('lc_payment_failed', 'Lifecycle: payment failed',
   'There was a problem with your payment',
   '<p>Hi {{first_name}},</p><p>Your recent payment attempt for {{description}} didn''t go through. No funds were taken beyond any temporary authorization.</p><p><a href="{{pay_url}}">Try again securely</a></p><p>If this keeps happening, reply to this email and we''ll help directly.</p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, your payment for {{description}} didn''t go through. Try again: {{pay_url}}',
   'visitor'),
  ('lc_payment_reminder', 'Lifecycle: payment reminder',
   'Reminder: invoice {{invoice_number}} is due',
   '<p>Hi {{first_name}},</p><p>Invoice {{invoice_number}} for <strong>{{amount}}</strong> is due {{due_on}}.</p><p><a href="{{pay_url}}">Pay securely online</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, invoice {{invoice_number}} for {{amount}} is due {{due_on}}: {{pay_url}}',
   'visitor'),
  ('lc_portal_welcome', 'Lifecycle: portal welcome',
   'Welcome to your Redmont client portal',
   '<p>Hi {{first_name}},</p><p>Your client portal is now active. It''s the one place for your project roadmap, files, approvals, training, support, and reports.</p><p><a href="{{portal_url}}">Sign in to your portal</a></p><p>Your first step is waiting inside: {{next_step_line}}</p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, your client portal is active: {{portal_url}}. First step: {{next_step_line}}',
   'visitor'),
  ('lc_team_invite', 'Lifecycle: team member invite',
   'You''ve been invited to the {{business_name}} client portal',
   '<p>Hi {{first_name}},</p><p>{{inviter_name}} invited you to the {{business_name}} portal with Redmont Strategies Group.</p><p><a href="{{invite_url}}">Accept your invitation</a></p><p>This link expires in 7 days.</p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, {{inviter_name}} invited you to the {{business_name}} client portal: {{invite_url}}',
   'visitor'),
  ('lc_onboarding_reminder', 'Lifecycle: onboarding reminder',
   'A few items are waiting on you',
   '<p>Hi {{first_name}},</p><p>Your project is moving — a few onboarding items are waiting on your side:</p><p>{{items_html}}</p><p><a href="{{portal_url}}">Open your portal</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, onboarding items waiting on you: {{items_text}} — {{portal_url}}',
   'visitor'),
  ('lc_milestone_update', 'Lifecycle: milestone update',
   'Project update: {{milestone_name}} — {{status_label}}',
   '<p>Hi {{first_name}},</p><p><strong>{{milestone_name}}</strong> is now <strong>{{status_label}}</strong>.</p><p>{{note}}</p><p><a href="{{portal_url}}">View your project roadmap</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, {{milestone_name}} is now {{status_label}}. {{portal_url}}',
   'visitor'),
  ('lc_approval_request', 'Lifecycle: approval request',
   'Your approval is requested: {{approval_title}}',
   '<p>Hi {{first_name}},</p><p>We''d like your approval on <strong>{{approval_title}}</strong>{{due_line}}.</p><p><a href="{{portal_url}}">Review and respond in your portal</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, your approval is requested: {{approval_title}}. {{portal_url}}',
   'visitor'),
  ('lc_project_delay', 'Lifecycle: project delay notice',
   'A schedule update on your project',
   '<p>Hi {{first_name}},</p><p>A quick, honest update: <strong>{{milestone_name}}</strong> is running behind its target date.</p><p>{{note}}</p><p>The updated timeline is reflected on your roadmap. Nothing is needed from you unless noted there.</p><p><a href="{{portal_url}}">View the updated roadmap</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, {{milestone_name}} is running behind target. Details: {{portal_url}}',
   'visitor'),
  ('lc_training_assigned', 'Lifecycle: training assigned',
   'New training available: {{training_title}}',
   '<p>Hi {{first_name}},</p><p><strong>{{training_title}}</strong> has been added to your training library{{required_line}}.</p><p><a href="{{portal_url}}">Open your training library</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, new training: {{training_title}}. {{portal_url}}',
   'visitor'),
  ('lc_ticket_created', 'Lifecycle: ticket created',
   'Ticket #{{ticket_number}} received — {{subject}}',
   '<p>Hi {{first_name}},</p><p>We''ve received your support request <strong>#{{ticket_number}}: {{subject}}</strong>.</p><p>{{sla_line}}</p><p><a href="{{portal_url}}">Track your ticket</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, ticket #{{ticket_number}} received: {{subject}}. {{portal_url}}',
   'visitor'),
  ('lc_ticket_created_internal', 'Lifecycle: ticket created (internal)',
   'New {{priority}} ticket #{{ticket_number}} — {{business_name}}',
   '<p>New ticket from {{business_name}}: <strong>#{{ticket_number}} {{subject}}</strong> ({{priority}}).</p><p><a href="{{admin_url}}">Open in Client OS</a></p>',
   'New {{priority}} ticket #{{ticket_number}} from {{business_name}}: {{subject}}. {{admin_url}}',
   'internal'),
  ('lc_ticket_updated', 'Lifecycle: ticket updated',
   'Update on ticket #{{ticket_number}}',
   '<p>Hi {{first_name}},</p><p>There''s an update on <strong>#{{ticket_number}}: {{subject}}</strong>.</p><p>{{note}}</p><p><a href="{{portal_url}}">View the full thread</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, update on ticket #{{ticket_number}}: {{note}} — {{portal_url}}',
   'visitor'),
  ('lc_ticket_resolved', 'Lifecycle: ticket resolved',
   'Ticket #{{ticket_number}} resolved',
   '<p>Hi {{first_name}},</p><p><strong>#{{ticket_number}}: {{subject}}</strong> has been resolved.</p><p>{{resolution}}</p><p>If everything looks good, you can confirm closure in your portal — or reply there if anything still isn''t right.</p><p><a href="{{portal_url}}">Review and confirm</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, ticket #{{ticket_number}} is resolved. Confirm or reopen: {{portal_url}}',
   'visitor'),
  ('lc_report_published', 'Lifecycle: report published',
   'Your {{period_label}} performance report is ready',
   '<p>Hi {{first_name}},</p><p>Your {{period_label}} performance report is ready in your portal — including wins, your scorecard, and priorities for next month.</p><p><a href="{{portal_url}}">Read your report</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, your {{period_label}} performance report is ready: {{portal_url}}',
   'visitor'),
  ('lc_renewal_reminder', 'Lifecycle: renewal reminder',
   'Coming up: {{renewal_name}} renews {{renews_on}}',
   '<p>Hi {{first_name}},</p><p>A heads-up that <strong>{{renewal_name}}</strong> renews on {{renews_on}}.</p><p>We''ll review it together at your next strategy call — or reach out any time before then.</p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, {{renewal_name}} renews on {{renews_on}}.',
   'visitor'),
  ('lc_strategy_review_reminder', 'Lifecycle: strategy review reminder',
   'Time for your strategy review',
   '<p>Hi {{first_name}},</p><p>It''s been a little while since your last strategy review. A short call keeps your roadmap current and your systems compounding.</p><p><a href="{{book_url}}">Book your strategy call</a></p><p>— Redmont Strategies Group</p>',
   'Hi {{first_name}}, time for a strategy review: {{book_url}}',
   'visitor'),
  ('lc_lead_assigned_internal', 'Lifecycle: lead assigned (internal)',
   'Lead assigned to you — {{business_name}}',
   '<p>{{business_name}} ({{full_name}}, {{email}}) was assigned to you.</p><p>Category: {{service_category}} · Score: {{score}}</p><p><a href="{{admin_url}}">Open in Client OS</a></p>',
   'Lead assigned: {{business_name}} ({{full_name}}). {{admin_url}}',
   'internal')
on conflict (key) do nothing;
