-- Native Redmont Strategies Group scheduling platform.
-- Service-role only (RLS on, no public policies). Safe to re-run where noted.

-- ---------------------------------------------------------------------------
-- Extend leads for intake / booking pipeline
-- ---------------------------------------------------------------------------

-- Ensure lead-management columns exist (safe if an earlier migration was skipped).
alter table public.leads
  add column if not exists status text not null default 'new',
  add column if not exists notes text,
  add column if not exists owner text,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.leads
  add column if not exists phone_normalized text,
  add column if not exists business_domain text,
  add column if not exists qualification_score integer,
  add column if not exists qualification_outcome text,
  add column if not exists qualification_snapshot jsonb,
  add column if not exists consent_at timestamptz,
  add column if not exists session_token text,
  add column if not exists is_test boolean not null default false,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists employee_count text,
  add column if not exists monthly_revenue_range text,
  add column if not exists heard_about text,
  add column if not exists business_location text,
  add column if not exists service_requested text;

-- Map legacy statuses, then widen the check constraint.
update public.leads set status = 'appointment_booked' where status = 'meeting_scheduled';
update public.leads set status = 'converted' where status = 'won';
update public.leads set status = 'closed' where status = 'lost';

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads
  add constraint leads_status_check check (status in (
    'new', 'contacted', 'qualified', 'meeting_scheduled', 'won', 'lost', 'spam', 'archived',
    'intake_started', 'intake_abandoned', 'submitted', 'qualified_not_booked',
    'appointment_booked', 'manual_review', 'not_eligible', 'rescheduled',
    'cancelled', 'no_show', 'completed', 'follow_up_required', 'converted', 'closed'
  ));

create index if not exists leads_phone_normalized_idx on public.leads (phone_normalized);
create index if not exists leads_business_domain_idx on public.leads (business_domain);
create index if not exists leads_qualification_outcome_idx on public.leads (qualification_outcome);
create index if not exists leads_session_token_idx on public.leads (session_token);
create index if not exists leads_is_test_idx on public.leads (is_test);

-- ---------------------------------------------------------------------------
-- Team members
-- ---------------------------------------------------------------------------

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  timezone text not null default 'America/New_York',
  role text not null default 'consultant',
  color text not null default '#b3243a',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.team_members enable row level security;
create unique index if not exists team_members_email_uidx on public.team_members (lower(email)) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Services catalog
-- ---------------------------------------------------------------------------

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.services enable row level security;
create unique index if not exists services_slug_uidx on public.services (slug) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Appointment types
-- ---------------------------------------------------------------------------

create table if not exists public.appointment_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  internal_name text,
  public_description text,
  service_id uuid references public.services(id) on delete set null,
  slug text not null,
  duration_minutes integer not null default 30,
  buffer_before_minutes integer not null default 0,
  buffer_after_minutes integer not null default 10,
  min_notice_minutes integer not null default 1440,
  max_advance_days integer not null default 60,
  team_member_id uuid references public.team_members(id) on delete set null,
  meeting_formats jsonb not null default '["phone","google_meet"]'::jsonb,
  location text,
  color text not null default '#b3243a',
  max_bookings_per_day integer,
  max_bookings_per_week integer,
  price_cents integer,
  confirmation_message text,
  reminder_offsets_minutes jsonb not null default '[0,1440,180,60]'::jsonb,
  intake_questions jsonb not null default '[]'::jsonb,
  qualification_override jsonb,
  active boolean not null default true,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.appointment_types enable row level security;
create unique index if not exists appointment_types_slug_uidx on public.appointment_types (slug) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Availability
-- ---------------------------------------------------------------------------

create table if not exists public.availability_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Default',
  team_member_id uuid references public.team_members(id) on delete cascade,
  appointment_type_id uuid references public.appointment_types(id) on delete cascade,
  timezone text not null default 'America/New_York',
  active boolean not null default true,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.availability_schedules enable row level security;

create table if not exists public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.availability_schedules(id) on delete cascade,
  -- 0=Sunday .. 6=Saturday; null = date-specific
  day_of_week integer check (day_of_week is null or (day_of_week >= 0 and day_of_week <= 6)),
  specific_date date,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (
    (day_of_week is not null and specific_date is null)
    or (day_of_week is null and specific_date is not null)
  ),
  check (end_time > start_time)
);

alter table public.availability_windows enable row level security;
create index if not exists availability_windows_schedule_idx on public.availability_windows (schedule_id);

create table if not exists public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid references public.team_members(id) on delete cascade,
  title text not null default 'Unavailable',
  block_type text not null default 'blackout'
    check (block_type in ('blackout', 'holiday', 'vacation', 'break', 'manual')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.calendar_blocks enable row level security;
create index if not exists calendar_blocks_range_idx on public.calendar_blocks (starts_at, ends_at);
create index if not exists calendar_blocks_member_idx on public.calendar_blocks (team_member_id);

-- ---------------------------------------------------------------------------
-- Qualification
-- ---------------------------------------------------------------------------

create table if not exists public.qualification_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qualification_forms enable row level security;

create table if not exists public.qualification_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.qualification_forms(id) on delete cascade,
  key text not null,
  label text not null,
  help_text text,
  question_type text not null check (question_type in (
    'short_text', 'long_text', 'multiple_choice', 'checkboxes', 'dropdown',
    'yes_no', 'number', 'currency', 'date', 'rating', 'conditional'
  )),
  options jsonb not null default '[]'::jsonb,
  required boolean not null default true,
  sort_order integer not null default 0,
  point_map jsonb not null default '{}'::jsonb,
  max_points integer not null default 0,
  -- Show if parent question answer matches
  parent_question_id uuid references public.qualification_questions(id) on delete set null,
  show_when jsonb,
  service_ids jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qualification_questions enable row level security;
create unique index if not exists qualification_questions_form_key_uidx
  on public.qualification_questions (form_id, key);

create table if not exists public.qualification_rule_sets (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.qualification_forms(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  min_qualifying_score integer not null default 50,
  manual_review_min_score integer,
  manual_review_max_score integer,
  allow_calendar_on_manual_review boolean not null default false,
  outcome_messages jsonb not null default '{}'::jsonb,
  hard_rules jsonb not null default '[]'::jsonb,
  service_rules jsonb not null default '[]'::jsonb,
  priority_thresholds jsonb not null default '{"high":80,"medium":50,"low":0}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qualification_rule_sets enable row level security;

create table if not exists public.qualification_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.qualification_rule_sets(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (rule_set_id, version)
);

alter table public.qualification_rule_versions enable row level security;

create table if not exists public.qualification_responses (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  session_id uuid,
  form_id uuid references public.qualification_forms(id) on delete set null,
  question_id uuid references public.qualification_questions(id) on delete set null,
  question_key text not null,
  answer jsonb not null,
  points_earned integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.qualification_responses enable row level security;
create index if not exists qualification_responses_lead_idx on public.qualification_responses (lead_id);
create index if not exists qualification_responses_session_idx on public.qualification_responses (session_id);

create table if not exists public.qualification_results (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  session_id uuid,
  rule_set_id uuid references public.qualification_rule_sets(id) on delete set null,
  rule_version integer,
  total_score integer not null default 0,
  max_score integer not null default 0,
  outcome text not null check (outcome in ('qualified', 'manual_review', 'not_eligible')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  rule_hits jsonb not null default '[]'::jsonb,
  score_breakdown jsonb not null default '{}'::jsonb,
  overridden_by text,
  override_outcome text,
  created_at timestamptz not null default now()
);

alter table public.qualification_results enable row level security;
create index if not exists qualification_results_lead_idx on public.qualification_results (lead_id);
create index if not exists qualification_results_outcome_idx on public.qualification_results (outcome);

-- ---------------------------------------------------------------------------
-- Booking sessions (funnel autosave)
-- ---------------------------------------------------------------------------

create table if not exists public.booking_sessions (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  step text not null default 'service',
  service_id uuid references public.services(id) on delete set null,
  appointment_type_id uuid references public.appointment_types(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  contact jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  qualification_outcome text,
  qualification_score integer,
  qualification_result_id uuid references public.qualification_results(id) on delete set null,
  timezone text,
  meeting_format text,
  attribution jsonb not null default '{}'::jsonb,
  is_test boolean not null default false,
  expires_at timestamptz not null,
  completed_at timestamptz,
  abandoned_at timestamptz,
  booking_link_sent_at timestamptz,
  booking_link_opened_at timestamptz,
  follow_up_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.booking_sessions enable row level security;
create unique index if not exists booking_sessions_token_uidx on public.booking_sessions (token);
create index if not exists booking_sessions_expires_idx on public.booking_sessions (expires_at);
create index if not exists booking_sessions_outcome_idx on public.booking_sessions (qualification_outcome);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  session_id uuid references public.booking_sessions(id) on delete set null,
  appointment_type_id uuid references public.appointment_types(id) on delete set null,
  team_member_id uuid references public.team_members(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  visitor_timezone text not null,
  admin_timezone text not null default 'America/New_York',
  meeting_format text not null default 'phone',
  meeting_location text,
  meeting_link text,
  status text not null default 'confirmed' check (status in (
    'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show'
  )),
  manage_token text not null,
  ical_uid text not null,
  ical_sequence integer not null default 0,
  idempotency_key text,
  visitor_notes text,
  internal_notes text,
  cancellation_reason text,
  cancelled_at timestamptz,
  rescheduled_from timestamptz,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.bookings enable row level security;
create unique index if not exists bookings_manage_token_uidx on public.bookings (manage_token);
create unique index if not exists bookings_idempotency_uidx on public.bookings (idempotency_key) where idempotency_key is not null;
create index if not exists bookings_starts_at_idx on public.bookings (starts_at);
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_lead_idx on public.bookings (lead_id);
create index if not exists bookings_member_idx on public.bookings (team_member_id);
create index if not exists bookings_type_idx on public.bookings (appointment_type_id);

-- Prevent double-booking: no overlapping active bookings for same assignee
create extension if not exists btree_gist;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_no_overlap'
  ) then
    alter table public.bookings
      add constraint bookings_no_overlap
      exclude using gist (
        team_member_id with =,
        tstzrange(starts_at, ends_at, '[)') with &&
      )
      where (status in ('confirmed', 'rescheduled') and team_member_id is not null);
  end if;
end $$;

create table if not exists public.booking_attendees (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  role text not null default 'visitor' check (role in ('visitor', 'host', 'guest')),
  name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.booking_attendees enable row level security;

create table if not exists public.booking_changes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  change_type text not null check (change_type in (
    'created', 'rescheduled', 'cancelled', 'completed', 'no_show', 'notes_updated', 'format_updated'
  )),
  actor text not null default 'visitor',
  before_snapshot jsonb,
  after_snapshot jsonb,
  note text,
  created_at timestamptz not null default now()
);

alter table public.booking_changes enable row level security;
create index if not exists booking_changes_booking_idx on public.booking_changes (booking_id);

-- ---------------------------------------------------------------------------
-- Notifications & reminders
-- ---------------------------------------------------------------------------

create table if not exists public.reminder_schedules (
  id uuid primary key default gen_random_uuid(),
  appointment_type_id uuid references public.appointment_types(id) on delete cascade,
  offset_minutes integer not null,
  channel text not null default 'email' check (channel in ('email', 'sms')),
  enabled boolean not null default true,
  template_key text not null default 'reminder',
  created_at timestamptz not null default now()
);

alter table public.reminder_schedules enable row level security;

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  name text not null,
  subject text not null,
  body_html text not null,
  body_text text,
  audience text not null default 'visitor' check (audience in ('visitor', 'internal')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_templates enable row level security;
create unique index if not exists notification_templates_key_uidx on public.notification_templates (key);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  template_key text,
  recipient text not null,
  subject text,
  channel text not null default 'email',
  status text not null default 'pending' check (status in (
    'pending', 'sent', 'failed', 'skipped'
  )),
  provider_id text,
  error text,
  booking_id uuid references public.bookings(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.notification_deliveries enable row level security;
create index if not exists notification_deliveries_status_idx on public.notification_deliveries (status);
create index if not exists notification_deliveries_booking_idx on public.notification_deliveries (booking_id);

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  due_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  )),
  attempts integer not null default 0,
  last_error text,
  booking_id uuid references public.bookings(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.notification_jobs enable row level security;
create index if not exists notification_jobs_due_idx on public.notification_jobs (due_at) where status = 'pending';
create index if not exists notification_jobs_status_idx on public.notification_jobs (status);

-- ---------------------------------------------------------------------------
-- Meeting locations & future integrations
-- ---------------------------------------------------------------------------

create table if not exists public.meeting_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_type text not null check (location_type in (
    'phone', 'google_meet', 'zoom', 'microsoft_teams', 'in_person', 'custom_link', 'custom_location'
  )),
  value text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.meeting_locations enable row level security;

create table if not exists public.calendar_integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  team_member_id uuid references public.team_members(id) on delete cascade,
  status text not null default 'not_connected' check (status in (
    'not_connected', 'connected', 'error', 'disabled'
  )),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_integrations enable row level security;

-- ---------------------------------------------------------------------------
-- Webhooks
-- ---------------------------------------------------------------------------

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  secret text not null,
  events jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.webhook_endpoints enable row level security;

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in (
    'pending', 'delivered', 'failed'
  )),
  attempts integer not null default 0,
  response_status integer,
  last_error text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

alter table public.webhook_deliveries enable row level security;
create unique index if not exists webhook_deliveries_idempotency_uidx on public.webhook_deliveries (idempotency_key);

-- ---------------------------------------------------------------------------
-- Activity, consent, analytics
-- ---------------------------------------------------------------------------

create table if not exists public.scheduling_activity_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  lead_id uuid references public.leads(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  action text not null,
  actor text not null default 'system',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.scheduling_activity_logs enable row level security;
create index if not exists scheduling_activity_lead_idx on public.scheduling_activity_logs (lead_id);
create index if not exists scheduling_activity_booking_idx on public.scheduling_activity_logs (booking_id);
create index if not exists scheduling_activity_created_idx on public.scheduling_activity_logs (created_at desc);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  session_id uuid references public.booking_sessions(id) on delete set null,
  consent_type text not null,
  granted boolean not null default true,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.consent_records enable row level security;

create table if not exists public.scheduling_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  session_id uuid,
  lead_id uuid,
  booking_id uuid,
  service_id uuid,
  appointment_type_id uuid,
  meta jsonb not null default '{}'::jsonb,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.scheduling_analytics_events enable row level security;
create index if not exists scheduling_analytics_type_idx on public.scheduling_analytics_events (event_type);
create index if not exists scheduling_analytics_created_idx on public.scheduling_analytics_events (created_at desc)
  where is_test = false;

create table if not exists public.scheduling_settings (
  id text primary key default 'default',
  admin_timezone text not null default 'America/New_York',
  internal_notification_emails jsonb not null default '["contact@redmontstrategiesgroup.com"]'::jsonb,
  sender_name text not null default 'Redmont Strategies Group',
  reply_to text not null default 'contact@redmontstrategiesgroup.com',
  bookings_paused boolean not null default false,
  abandon_hours integer not null default 24,
  max_follow_ups integer not null default 1,
  cancel_cutoff_minutes integer not null default 240,
  reschedule_cutoff_minutes integer not null default 240,
  updated_at timestamptz not null default now()
);

alter table public.scheduling_settings enable row level security;

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------

insert into public.scheduling_settings (id)
values ('default')
on conflict (id) do nothing;

insert into public.team_members (id, name, email, timezone, role, color)
values (
  'a0000000-0000-4000-8000-000000000001',
  'Redmont Strategies Group',
  'contact@redmontstrategiesgroup.com',
  'America/New_York',
  'owner',
  '#b3243a'
)
on conflict (id) do nothing;

insert into public.services (id, name, slug, description, sort_order) values
  ('b0000000-0000-4000-8000-000000000001', 'AI Strategy and Implementation', 'ai-strategy', 'Strategy and implementation for AI initiatives.', 10),
  ('b0000000-0000-4000-8000-000000000002', 'AI Automation', 'ai-automation', 'Automate workflows with AI.', 20),
  ('b0000000-0000-4000-8000-000000000003', 'Business Process Optimization', 'process-optimization', 'Improve core business processes.', 30),
  ('b0000000-0000-4000-8000-000000000004', 'Operations Consulting', 'operations', 'Operations structure and performance.', 40),
  ('b0000000-0000-4000-8000-000000000005', 'CRM and Internal Systems', 'crm-systems', 'CRM and internal tooling.', 50),
  ('b0000000-0000-4000-8000-000000000006', 'AI Agents', 'ai-agents', 'Custom AI agents for your business.', 60),
  ('b0000000-0000-4000-8000-000000000007', 'Web Development and Digital Infrastructure', 'web-development', 'Web and digital infrastructure.', 70),
  ('b0000000-0000-4000-8000-000000000008', 'Marketing and Lead Conversion Systems', 'marketing-conversion', 'Lead capture and conversion systems.', 80),
  ('b0000000-0000-4000-8000-000000000009', 'Custom Software', 'custom-software', 'Bespoke software solutions.', 90),
  ('b0000000-0000-4000-8000-000000000010', 'General Strategy Consultation', 'general-strategy', 'Broad strategy consultation.', 100),
  ('b0000000-0000-4000-8000-000000000011', 'Other', 'other', 'Something else.', 110)
on conflict (id) do nothing;

insert into public.appointment_types (
  id, name, internal_name, public_description, slug, duration_minutes,
  buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_advance_days,
  team_member_id, meeting_formats, color, confirmation_message, is_public, active
) values
  (
    'c0000000-0000-4000-8000-000000000001',
    '15-Minute Initial Fit Call',
    'fit_call_15',
    'A short call to determine fit and next steps.',
    'fit-call',
    15, 0, 5, 120, 30,
    'a0000000-0000-4000-8000-000000000001',
    '["phone","google_meet"]'::jsonb,
    '#b3243a',
    'Your fit call is confirmed. We look forward to speaking with you.',
    true, true
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    '30-Minute Strategy Consultation',
    'strategy_30',
    'A focused strategy consultation for qualified businesses.',
    'strategy',
    30, 0, 10, 1440, 60,
    'a0000000-0000-4000-8000-000000000001',
    '["phone","google_meet","zoom"]'::jsonb,
    '#d94b5e',
    'Your strategy consultation is confirmed.',
    true, true
  ),
  (
    'c0000000-0000-4000-8000-000000000003',
    '45-Minute Revenue Leak Review',
    'revenue_leak_45',
    'Identify where revenue is leaking across operations and conversion.',
    'revenue-leak',
    45, 5, 10, 1440, 45,
    'a0000000-0000-4000-8000-000000000001',
    '["phone","google_meet","zoom"]'::jsonb,
    '#8b1e2d',
    'Your revenue leak review is confirmed.',
    true, true
  ),
  (
    'c0000000-0000-4000-8000-000000000004',
    '60-Minute AI and Operations Assessment',
    'ai_ops_60',
    'A deeper assessment of AI and operations opportunities.',
    'ai-ops-assessment',
    60, 10, 15, 2880, 45,
    'a0000000-0000-4000-8000-000000000001',
    '["phone","google_meet","zoom","microsoft_teams"]'::jsonb,
    '#6b1522',
    'Your AI and operations assessment is confirmed.',
    true, true
  )
on conflict (id) do nothing;

insert into public.availability_schedules (id, name, team_member_id, timezone, active, paused)
values (
  'd0000000-0000-4000-8000-000000000001',
  'Default Business Hours',
  'a0000000-0000-4000-8000-000000000001',
  'America/New_York',
  true, false
)
on conflict (id) do nothing;

-- Mon–Fri 9:00–12:00 and 13:00–17:00 America/New_York
insert into public.availability_windows (schedule_id, day_of_week, start_time, end_time)
select 'd0000000-0000-4000-8000-000000000001', d, t.start_time::time, t.end_time::time
from generate_series(1, 5) as d
cross join (values ('09:00','12:00'), ('13:00','17:00')) as t(start_time, end_time)
where not exists (
  select 1 from public.availability_windows w
  where w.schedule_id = 'd0000000-0000-4000-8000-000000000001'
    and w.day_of_week = d
    and w.start_time = t.start_time::time
);

insert into public.qualification_forms (id, name, description, active)
values (
  'e0000000-0000-4000-8000-000000000001',
  'Strategy Consultation Intake',
  'Default qualification questionnaire for Redmont Strategies Group consultations.',
  true
)
on conflict (id) do nothing;

insert into public.qualification_questions (id, form_id, key, label, help_text, question_type, options, required, sort_order, point_map, max_points) values
  ('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'problem', 'What problem are you trying to solve?', null, 'long_text', '[]', true, 10, '{}', 10),
  ('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'result', 'What result are you trying to achieve?', null, 'long_text', '[]', true, 20, '{}', 10),
  ('f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'improvement_area', 'Which area of the business needs the most improvement?', null, 'dropdown',
    '["Lead response and conversion","Operations and delivery","Sales pipeline","Marketing systems","Internal tooling / CRM","AI and automation","Other"]'::jsonb, true, 30,
    '{"Lead response and conversion":15,"Operations and delivery":12,"Sales pipeline":14,"Marketing systems":12,"Internal tooling / CRM":10,"AI and automation":15,"Other":5}'::jsonb, 15),
  ('f0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', 'budget', 'What is your estimated project budget?', null, 'dropdown',
    '["Under $5,000","$5,000 – $15,000","$15,000 – $40,000","$40,000 – $100,000","$100,000+","Not sure yet"]'::jsonb, true, 40,
    '{"Under $5,000":0,"$5,000 – $15,000":10,"$15,000 – $40,000":25,"$40,000 – $100,000":35,"$100,000+":40,"Not sure yet":5}'::jsonb, 40),
  ('f0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000001', 'timeline', 'How soon would you like to begin?', null, 'dropdown',
    '["Immediately","This month","Next 90 days","Exploring / no timeline"]'::jsonb, true, 50,
    '{"Immediately":25,"This month":20,"Next 90 days":10,"Exploring / no timeline":0}'::jsonb, 25),
  ('f0000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000001', 'decision_maker', 'Are you the primary decision-maker?', null, 'yes_no', '["Yes","No"]'::jsonb, true, 60,
    '{"Yes":20,"No":5}'::jsonb, 20),
  ('f0000000-0000-4000-8000-000000000007', 'e0000000-0000-4000-8000-000000000001', 'stakeholders', 'Are there other stakeholders involved?', null, 'yes_no', '["Yes","No"]'::jsonb, false, 70,
    '{"Yes":5,"No":8}'::jsonb, 8),
  ('f0000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000001', 'uses_crm', 'Do you currently use a CRM?', null, 'yes_no', '["Yes","No"]'::jsonb, true, 80,
    '{"Yes":8,"No":5}'::jsonb, 8),
  ('f0000000-0000-4000-8000-000000000009', 'e0000000-0000-4000-8000-000000000001', 'uses_ai', 'Do you currently use automation or AI tools?', null, 'yes_no', '["Yes","No"]'::jsonb, true, 90,
    '{"Yes":8,"No":5}'::jsonb, 8),
  ('f0000000-0000-4000-8000-000000000010', 'e0000000-0000-4000-8000-000000000001', 'volume', 'Approximately how many leads, customers, or transactions do you handle per month?', null, 'dropdown',
    '["Under 20","20 – 100","100 – 500","500+"]'::jsonb, true, 100,
    '{"Under 20":5,"20 – 100":12,"100 – 500":18,"500+":20}'::jsonb, 20),
  ('f0000000-0000-4000-8000-000000000011', 'e0000000-0000-4000-8000-000000000001', 'response_time', 'What is your current lead response time?', null, 'dropdown',
    '["Under 5 minutes","Under 1 hour","Same day","More than a day","Inconsistent / unknown"]'::jsonb, false, 110,
    '{"Under 5 minutes":10,"Under 1 hour":12,"Same day":8,"More than a day":15,"Inconsistent / unknown":15}'::jsonb, 15),
  ('f0000000-0000-4000-8000-000000000012', 'e0000000-0000-4000-8000-000000000001', 'bottleneck', 'What is your biggest operational bottleneck?', null, 'long_text', '[]', true, 120, '{}', 10),
  ('f0000000-0000-4000-8000-000000000013', 'e0000000-0000-4000-8000-000000000001', 'prior_consultant', 'Have you worked with a consultant or agency before?', null, 'yes_no', '["Yes","No"]'::jsonb, false, 130,
    '{"Yes":5,"No":5}'::jsonb, 5),
  ('f0000000-0000-4000-8000-000000000014', 'e0000000-0000-4000-8000-000000000001', 'ready_to_invest', 'Are you prepared to invest if there is a clear business case and expected return?', null, 'yes_no', '["Yes","No","Unsure"]'::jsonb, true, 140,
    '{"Yes":25,"No":0,"Unsure":8}'::jsonb, 25)
on conflict (id) do nothing;

insert into public.qualification_rule_sets (
  id, form_id, name, status, min_qualifying_score, manual_review_min_score, manual_review_max_score,
  allow_calendar_on_manual_review, outcome_messages, hard_rules, priority_thresholds, published_at
) values (
  'aa000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'Default Strategy Rules',
  'published',
  55,
  35,
  54,
  false,
  '{
    "qualified": "Based on your responses, your business appears to be a strong fit for a Redmont Strategies Group strategy consultation. Select a time below to continue.",
    "manual_review": "Thank you for submitting your information. Our team will review your request and contact you regarding the best next step.",
    "not_eligible": "Thank you for your interest in Redmont Strategies Group. Based on the information provided, a direct strategy consultation may not be the best next step at this time. We have saved your information and may contact you with a more appropriate resource or service."
  }'::jsonb,
  '[
    {"id":"dq_budget","field":"budget","op":"eq","value":"Under $5,000","outcome":"not_eligible","label":"Budget below minimum"},
    {"id":"dq_invest","field":"ready_to_invest","op":"eq","value":"No","outcome":"not_eligible","label":"Not prepared to invest"},
    {"id":"dq_timeline","field":"timeline","op":"eq","value":"Exploring / no timeline","outcome":"manual_review","label":"No clear timeline"}
  ]'::jsonb,
  '{"high":80,"medium":55,"low":0}'::jsonb,
  now()
)
on conflict (id) do nothing;

insert into public.qualification_rule_versions (rule_set_id, version, snapshot)
select
  'aa000000-0000-4000-8000-000000000001',
  1,
  row_to_json(r)::jsonb
from public.qualification_rule_sets r
where r.id = 'aa000000-0000-4000-8000-000000000001'
  and not exists (
    select 1 from public.qualification_rule_versions v
    where v.rule_set_id = r.id and v.version = 1
  );

insert into public.notification_templates (key, name, subject, body_html, body_text, audience) values
  ('visitor_submission', 'Visitor submission confirmation', 'We received your consultation request',
   '<p>Hi {{first_name}},</p><p>Thank you for contacting Redmont Strategies Group. We have received your information and will follow up with next steps.</p>',
   'Hi {{first_name}}, thank you for contacting Redmont Strategies Group.', 'visitor'),
  ('visitor_booking_confirmation', 'Visitor booking confirmation', 'Your consultation is confirmed — {{appointment_type}}',
   '<p>Hi {{first_name}},</p><p>Your {{appointment_type}} is confirmed for <strong>{{appointment_time_local}}</strong> ({{timezone}}).</p><p>Meeting format: {{meeting_format}}</p><p><a href="{{manage_url}}">Manage your appointment</a></p>',
   'Your consultation is confirmed for {{appointment_time_local}}.', 'visitor'),
  ('visitor_reminder', 'Visitor reminder', 'Reminder: {{appointment_type}} on {{appointment_time_local}}',
   '<p>Hi {{first_name}},</p><p>This is a reminder that your {{appointment_type}} is scheduled for <strong>{{appointment_time_local}}</strong>.</p><p><a href="{{manage_url}}">Manage appointment</a></p>',
   'Reminder: your consultation is on {{appointment_time_local}}.', 'visitor'),
  ('visitor_reschedule', 'Visitor reschedule confirmation', 'Your consultation was rescheduled',
   '<p>Hi {{first_name}},</p><p>Your appointment has been rescheduled to <strong>{{appointment_time_local}}</strong>.</p>',
   'Your appointment was rescheduled to {{appointment_time_local}}.', 'visitor'),
  ('visitor_cancellation', 'Visitor cancellation confirmation', 'Your consultation was cancelled',
   '<p>Hi {{first_name}},</p><p>Your appointment has been cancelled. If you would like to request a new consultation, visit <a href="{{book_url}}">our booking page</a>.</p>',
   'Your appointment has been cancelled.', 'visitor'),
  ('visitor_not_eligible', 'Visitor not eligible follow-up', 'Thank you for your interest in Redmont Strategies Group',
   '<p>Hi {{first_name}},</p><p>Thank you for your interest. Based on the information provided, a direct strategy consultation may not be the best next step at this time. We may follow up with a more appropriate resource.</p>',
   'Thank you for your interest in Redmont Strategies Group.', 'visitor'),
  ('visitor_manual_review', 'Visitor manual review', 'We are reviewing your consultation request',
   '<p>Hi {{first_name}},</p><p>Thank you for submitting your information. Our team will review your request and contact you regarding the best next step.</p>',
   'We are reviewing your consultation request.', 'visitor'),
  ('visitor_finish_booking', 'Finish booking link', 'Finish booking your Redmont Strategies Group consultation',
   '<p>Hi {{first_name}},</p><p>You qualified for a strategy consultation. Use this secure link to finish booking: <a href="{{finish_booking_url}}">Complete your booking</a></p>',
   'Finish booking: {{finish_booking_url}}', 'visitor'),
  ('internal_lead_submitted', 'Internal lead submitted', 'New consultation intake — {{business_name}}',
   '<p>New intake from <strong>{{full_name}}</strong> ({{business_name}}).</p><p>Email: {{email}}<br/>Phone: {{phone}}<br/>Service: {{service}}<br/>Score: {{qualification_score}}<br/>Outcome: {{qualification_outcome}}</p><p><a href="{{admin_lead_url}}">Open lead</a></p>',
   'New intake: {{full_name}} / {{business_name}}', 'internal'),
  ('internal_booking_created', 'Internal booking created', 'Appointment booked — {{business_name}} — {{appointment_time_admin}}',
   '<p>Booking confirmed.</p><ul><li>{{full_name}} / {{business_name}}</li><li>{{email}} / {{phone}}</li><li>{{appointment_type}} at {{appointment_time_admin}}</li><li>Format: {{meeting_format}}</li><li>Score: {{qualification_score}} ({{qualification_outcome}})</li><li>Source: {{lead_source}}</li></ul><p><a href="{{admin_lead_url}}">Lead</a> · <a href="{{admin_booking_url}}">Appointment</a></p>',
   'Booking: {{full_name}} at {{appointment_time_admin}}', 'internal'),
  ('internal_manual_review', 'Internal manual review', 'Manual review needed — {{business_name}}',
   '<p>Lead requires manual review.</p><p>{{full_name}} · {{email}} · Score {{qualification_score}}</p><p><a href="{{admin_lead_url}}">Open lead</a></p>',
   'Manual review: {{full_name}}', 'internal'),
  ('internal_not_eligible', 'Internal not eligible', 'Not eligible intake — {{business_name}}',
   '<p>Lead marked not currently eligible.</p><p>{{full_name}} · {{email}} · Score {{qualification_score}}</p><p><a href="{{admin_lead_url}}">Open lead</a></p>',
   'Not eligible: {{full_name}}', 'internal'),
  ('internal_qualified_abandoned', 'Internal qualified abandoned', 'Qualified lead did not book — {{business_name}}',
   '<p>Qualified lead has not completed booking.</p><p>{{full_name}} · {{email}}</p><p><a href="{{admin_lead_url}}">Open lead</a></p>',
   'Qualified not booked: {{full_name}}', 'internal'),
  ('internal_reschedule', 'Internal reschedule', 'Appointment rescheduled — {{business_name}}',
   '<p>Rescheduled to {{appointment_time_admin}}.</p><p><a href="{{admin_booking_url}}">Open appointment</a></p>',
   'Rescheduled: {{full_name}}', 'internal'),
  ('internal_cancellation', 'Internal cancellation', 'Appointment cancelled — {{business_name}}',
   '<p>Cancelled appointment for {{full_name}}.</p><p><a href="{{admin_booking_url}}">Open appointment</a></p>',
   'Cancelled: {{full_name}}', 'internal'),
  ('internal_no_show', 'Internal no-show', 'No-show — {{business_name}}',
   '<p>Marked no-show: {{full_name}} at {{appointment_time_admin}}</p>',
   'No-show: {{full_name}}', 'internal'),
  ('internal_email_failed', 'Internal email failure', 'Email delivery failed',
   '<p>A scheduling email failed to deliver.</p><p>{{error}}</p>',
   'Email failed: {{error}}', 'internal')
on conflict (key) do nothing;

insert into public.reminder_schedules (appointment_type_id, offset_minutes, channel, enabled, template_key)
select t.id, o.offset_minutes, 'email', true, 'visitor_reminder'
from public.appointment_types t
cross join (values (0), (1440), (180), (60), (15)) as o(offset_minutes)
where t.id in (
  'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000003',
  'c0000000-0000-4000-8000-000000000004'
)
and not exists (
  select 1 from public.reminder_schedules r
  where r.appointment_type_id = t.id and r.offset_minutes = o.offset_minutes
);

insert into public.meeting_locations (name, location_type, value, active)
select v.name, v.location_type, v.value, true
from (values
  ('Phone call', 'phone', null::text),
  ('Google Meet', 'google_meet', null),
  ('Zoom', 'zoom', null),
  ('Microsoft Teams', 'microsoft_teams', null),
  ('In-person (South Shore, MA)', 'in_person', 'Plymouth County / South Shore, MA')
) as v(name, location_type, value)
where not exists (
  select 1 from public.meeting_locations m where m.name = v.name
);

insert into public.calendar_integrations (provider, team_member_id, status)
select v.provider, 'a0000000-0000-4000-8000-000000000001', 'not_connected'
from (values
  ('google_calendar'),
  ('microsoft_outlook'),
  ('zoom')
) as v(provider)
where not exists (
  select 1 from public.calendar_integrations c
  where c.provider = v.provider
    and c.team_member_id = 'a0000000-0000-4000-8000-000000000001'
);
