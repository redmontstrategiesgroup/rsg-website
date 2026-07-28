-- RSG Supabase schema backup (project xnhbrfbuvssxpciikhws) — captured 2026-07-27
-- Restore into a fresh Supabase project via the SQL editor (run this file first, then data.sql).


-- ============ EXTENSIONS, ENUM TYPES, TABLES ============

create extension if not exists btree_gist with schema extensions;
create extension if not exists hypopg with schema extensions;
create extension if not exists index_advisor with schema extensions;
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
create extension if not exists "uuid-ossp" with schema extensions;

create type public.audit_delivery_status as enum ('pending', 'sent', 'failed');
create type public.audit_lead_status as enum ('new', 'report_sent', 'contacted', 'call_booked', 'qualified', 'client', 'closed_lost', 'archived');
create type public.audit_session_status as enum ('started', 'in_progress', 'review', 'completed', 'abandoned');
create type public.rsg_appointment_status as enum ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.rsg_call_channel as enum ('phone', 'simulator');
create type public.rsg_call_direction as enum ('inbound', 'outbound');
create type public.rsg_call_outcome as enum ('booked', 'rescheduled', 'cancelled_appointment', 'qualified_no_booking', 'callback_requested', 'transferred', 'support_ticket', 'info_only', 'not_qualified', 'spam', 'voicemail', 'error', 'incomplete');
create type public.rsg_call_status as enum ('in_progress', 'completed', 'failed', 'abandoned', 'transferred');
create type public.rsg_escalation as enum ('none', 'requested', 'transferred', 'callback', 'emergency');
create type public.rsg_job_status as enum ('pending', 'processing', 'done', 'failed', 'cancelled');
create type public.rsg_lead_classification as enum ('priority_opportunity', 'qualified_lead', 'early_stage', 'existing_client', 'partner_referral', 'vendor', 'support_request', 'not_qualified', 'spam');
create type public.rsg_lead_status as enum ('new', 'contacted', 'qualified', 'scheduled', 'won', 'lost', 'disqualified');
create type public.rsg_message_channel as enum ('sms', 'email');
create type public.rsg_message_direction as enum ('outbound', 'inbound');
create type public.rsg_message_status as enum ('queued', 'sent', 'delivered', 'failed');
create type public.rsg_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.rsg_staff_role as enum ('owner', 'admin', 'staff', 'viewer');
create type public.rsg_ticket_status as enum ('open', 'in_progress', 'waiting', 'resolved', 'closed');

CREATE TABLE IF NOT EXISTS public.action_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brief_id uuid,
  title text NOT NULL,
  description text,
  why_it_matters text,
  status text NOT NULL DEFAULT 'new'::text,
  priority text NOT NULL DEFAULT 'medium'::text,
  impact_score integer,
  effort_score integer,
  owner_id uuid,
  owner_name text,
  category text,
  due_date date,
  deferred_until date,
  completed_at timestamp with time zone,
  source_section text,
  requires_review boolean NOT NULL DEFAULT true,
  approved_at timestamp with time zone,
  dismissal_reason text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_generations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  generation_type text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  output jsonb NOT NULL,
  confidence integer,
  approval_status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.appointment_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  internal_name text,
  public_description text,
  service_id uuid,
  slug text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  buffer_before_minutes integer NOT NULL DEFAULT 0,
  buffer_after_minutes integer NOT NULL DEFAULT 10,
  min_notice_minutes integer NOT NULL DEFAULT 1440,
  max_advance_days integer NOT NULL DEFAULT 60,
  team_member_id uuid,
  meeting_formats jsonb NOT NULL DEFAULT '["phone", "google_meet"]'::jsonb,
  location text,
  color text NOT NULL DEFAULT '#b3243a'::text,
  max_bookings_per_day integer,
  max_bookings_per_week integer,
  price_cents integer,
  confirmation_message text,
  reminder_offsets_minutes jsonb NOT NULL DEFAULT '[0, 1440, 180, 60]'::jsonb,
  intake_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  qualification_override jsonb,
  active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.audit_admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_admin_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  author_id uuid,
  note text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_admin_users (
  id uuid NOT NULL,
  email text NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'consultant'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  session_id uuid,
  event_type text NOT NULL,
  step integer,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  question_key text NOT NULL,
  step integer NOT NULL,
  value jsonb NOT NULL,
  answered_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_booking_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'calendly'::text,
  event_uri text,
  invitee_uri text,
  payload jsonb,
  booked_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_businesses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  name text,
  website_url text,
  industry text,
  primary_offer text,
  business_model text,
  service_area text,
  employees text,
  revenue_range text,
  avg_customer_value numeric,
  sales_cycle text,
  growth_goal text,
  biggest_problem text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_consent_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  contact_id uuid,
  consent_type text NOT NULL,
  granted boolean NOT NULL,
  statement text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  lead_status audit_lead_status NOT NULL DEFAULT 'new'::audit_lead_status,
  assigned_to uuid,
  crm_sync_status text DEFAULT 'pending'::text,
  crm_sync_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_email_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  email_type text NOT NULL,
  recipient text NOT NULL,
  status audit_delivery_status NOT NULL DEFAULT 'pending'::audit_delivery_status,
  provider_message_id text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_identifier text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  access_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'::text),
  token_expires_at timestamp with time zone NOT NULL DEFAULT (now() + '90 days'::interval),
  revoked boolean NOT NULL DEFAULT false,
  engine_version text NOT NULL,
  scores jsonb NOT NULL,
  score_details jsonb NOT NULL,
  executive_summary text NOT NULL,
  top_leaks jsonb NOT NULL,
  findings jsonb NOT NULL,
  roadmap jsonb NOT NULL,
  recommendations jsonb NOT NULL,
  opportunity jsonb,
  internal_summary text,
  viewed_at timestamp with time zone,
  pdf_generated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_scoring_overrides (
  id integer NOT NULL DEFAULT 1,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  status audit_session_status NOT NULL DEFAULT 'started'::audit_session_status,
  current_step integer NOT NULL DEFAULT 1,
  furthest_step integer NOT NULL DEFAULT 1,
  resume_token uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_source text,
  user_agent text,
  ip_hash text,
  engine_version text
);

CREATE TABLE IF NOT EXISTS public.audit_website_scans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  url text NOT NULL,
  scan_status text NOT NULL DEFAULT 'pending'::text,
  checks jsonb,
  scanned_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.availability_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Default'::text,
  team_member_id uuid,
  appointment_type_id uuid,
  timezone text NOT NULL DEFAULT 'America/New_York'::text,
  active boolean NOT NULL DEFAULT true,
  paused boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.availability_windows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL,
  day_of_week integer,
  specific_date date,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_attendees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'visitor'::text,
  name text,
  email text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  change_type text NOT NULL,
  actor text NOT NULL DEFAULT 'visitor'::text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token text NOT NULL,
  step text NOT NULL DEFAULT 'service'::text,
  service_id uuid,
  appointment_type_id uuid,
  lead_id uuid,
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  qualification_outcome text,
  qualification_score integer,
  qualification_result_id uuid,
  timezone text,
  meeting_format text,
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_test boolean NOT NULL DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  abandoned_at timestamp with time zone,
  booking_link_sent_at timestamp with time zone,
  booking_link_opened_at timestamp with time zone,
  follow_up_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid,
  session_id uuid,
  appointment_type_id uuid,
  team_member_id uuid,
  service_id uuid,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  visitor_timezone text NOT NULL,
  admin_timezone text NOT NULL DEFAULT 'America/New_York'::text,
  meeting_format text NOT NULL DEFAULT 'phone'::text,
  meeting_location text,
  meeting_link text,
  status text NOT NULL DEFAULT 'confirmed'::text,
  manage_token text NOT NULL,
  ical_uid text NOT NULL,
  ical_sequence integer NOT NULL DEFAULT 0,
  idempotency_key text,
  visitor_notes text,
  internal_notes text,
  cancellation_reason text,
  cancelled_at timestamp with time zone,
  rescheduled_from timestamp with time zone,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brief_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL,
  section_type text NOT NULL DEFAULT 'other'::text,
  heading text NOT NULL,
  content text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brief_sources (
  brief_id uuid NOT NULL,
  source_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.briefs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  brief_type text NOT NULL DEFAULT 'daily_executive'::text,
  schedule_name text,
  source_type text NOT NULL DEFAULT 'manual'::text,
  source_identifier text,
  executive_summary text,
  content_markdown text NOT NULL DEFAULT ''::text,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  brief_date date NOT NULL,
  generated_at timestamp with time zone,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  priority text NOT NULL DEFAULT 'medium'::text,
  status text NOT NULL DEFAULT 'published'::text,
  is_read boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  raw_payload jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_member_id uuid,
  title text NOT NULL DEFAULT 'Unavailable'::text,
  block_type text NOT NULL DEFAULT 'blackout'::text,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  team_member_id uuid,
  status text NOT NULL DEFAULT 'not_connected'::text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_roadmaps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  subscription_id uuid,
  title text NOT NULL,
  period_label text NOT NULL DEFAULT ''::text,
  status text NOT NULL DEFAULT 'draft'::text,
  summary text NOT NULL DEFAULT ''::text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_impact text NOT NULL DEFAULT ''::text,
  proposed_timeline text NOT NULL DEFAULT ''::text,
  review_scheduled_for timestamp with time zone,
  approved_at timestamp with time zone,
  approved_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  billing_frequency text NOT NULL DEFAULT 'monthly'::text,
  monthly_price_cents integer NOT NULL DEFAULT 0,
  annual_price_cents integer,
  setup_fee_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd'::text,
  included_hours numeric(6,2),
  additional_hourly_rate_cents integer,
  minimum_commitment_months integer NOT NULL DEFAULT 0,
  commitment_ends_at timestamp with time zone,
  started_at timestamp with time zone,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancellation_requested_at timestamp with time zone,
  cancellation_reason text,
  paused_at timestamp with time zone,
  ended_at timestamp with time zone,
  stripe_customer_id text,
  stripe_subscription_id text,
  payment_method_summary text NOT NULL DEFAULT ''::text,
  last_payment_status text NOT NULL DEFAULT ''::text,
  last_payment_at timestamp with time zone,
  failed_payment_count integer NOT NULL DEFAULT 0,
  account_manager text NOT NULL DEFAULT ''::text,
  technical_owner text NOT NULL DEFAULT ''::text,
  sla_notes text NOT NULL DEFAULT ''::text,
  admin_notes text NOT NULL DEFAULT ''::text,
  source text NOT NULL DEFAULT 'admin'::text,
  proposal_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  company text NOT NULL,
  plan text NOT NULL DEFAULT 'Strategy Audit'::text,
  member_since text,
  strategist text DEFAULT 'Redmont Strategies Group'::text,
  metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  systems jsonb NOT NULL DEFAULT '[]'::jsonb,
  projects jsonb NOT NULL DEFAULT '[]'::jsonb,
  activity jsonb NOT NULL DEFAULT '[]'::jsonb,
  deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  invoices jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  stripe_customer_id text
);

CREATE TABLE IF NOT EXISTS public.consent_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid,
  session_id uuid,
  consent_type text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  ip_hash text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dashboard_preferences (
  user_id uuid NOT NULL,
  notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_processing_preferences jsonb NOT NULL DEFAULT '{"enabled": false, "requireTaskReview": true, "requireOpportunityReview": true}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.entity_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ideas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brief_id uuid,
  title text NOT NULL,
  description text,
  idea_type text NOT NULL DEFAULT 'service'::text,
  status text NOT NULL DEFAULT 'captured'::text,
  rationale text,
  next_step text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ingestion_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  integration_id uuid,
  request_identifier uuid NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  status text NOT NULL,
  payload_hash text NOT NULL,
  brief_id uuid,
  raw_payload jsonb,
  error_message text,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  integration_type text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected'::text,
  configuration_encrypted bytea,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_success_at timestamp with time zone,
  last_failure_at timestamp with time zone,
  failure_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intelligence_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brief_id uuid,
  headline text NOT NULL,
  summary text,
  why_it_matters text,
  business_impact text,
  category text NOT NULL DEFAULT 'other'::text,
  urgency text NOT NULL DEFAULT 'medium'::text,
  confidence integer,
  geographic_relevance text,
  relevant_service text,
  target_industry text,
  date_observed date NOT NULL DEFAULT CURRENT_DATE,
  event_date date,
  publication_date date,
  source_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_name text NOT NULL,
  website text,
  email text NOT NULL,
  phone text,
  industry text,
  biggest_problem text,
  improvement_goal text,
  preferred_contact text,
  best_time text,
  timeline text,
  page_url text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  lead_score integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'website_contact_form'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new'::text,
  notes text,
  owner text,
  archived_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  phone_normalized text,
  business_domain text,
  qualification_score integer,
  qualification_outcome text,
  qualification_snapshot jsonb,
  consent_at timestamp with time zone,
  session_token text,
  is_test boolean NOT NULL DEFAULT false,
  first_name text,
  last_name text,
  employee_count text,
  monthly_revenue_range text,
  heard_about text,
  business_location text,
  service_requested text,
  service_plan_answers jsonb,
  recommended_plan text
);

CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  subscription_id uuid,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'maintenance'::text,
  description text NOT NULL DEFAULT ''::text,
  hours_spent numeric(6,2) NOT NULL DEFAULT 0,
  performed_by text NOT NULL DEFAULT ''::text,
  performed_at timestamp with time zone NOT NULL DEFAULT now(),
  visible_to_client boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.managed_service_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT ''::text,
  best_fit text NOT NULL DEFAULT ''::text,
  description text NOT NULL DEFAULT ''::text,
  monthly_price_cents integer,
  annual_price_cents integer,
  annual_discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  setup_fee_cents integer NOT NULL DEFAULT 0,
  custom_pricing boolean NOT NULL DEFAULT false,
  included_hours numeric(6,2),
  additional_hourly_rate_cents integer,
  support_level text NOT NULL DEFAULT ''::text,
  response_time text NOT NULL DEFAULT ''::text,
  minimum_commitment_months integer NOT NULL DEFAULT 0,
  cancellation_terms text NOT NULL DEFAULT ''::text,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  detailed_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  comparison jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommended boolean NOT NULL DEFAULT false,
  business_critical boolean NOT NULL DEFAULT false,
  tier_rank integer NOT NULL DEFAULT 0,
  base_plan_key text,
  client_id uuid,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location_type text NOT NULL,
  value text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  brief_id uuid,
  intelligence_item_id uuid,
  action_item_id uuid,
  opportunity_id uuid,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_key text,
  recipient text NOT NULL,
  subject text,
  channel text NOT NULL DEFAULT 'email'::text,
  status text NOT NULL DEFAULT 'pending'::text,
  provider_id text,
  error text,
  booking_id uuid,
  lead_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.notification_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  due_at timestamp with time zone NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'::text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  booking_id uuid,
  lead_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  audience text NOT NULL DEFAULT 'visitor'::text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  related_entity_type text,
  related_entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brief_id uuid,
  name text NOT NULL,
  description text,
  business_rationale text,
  opportunity_type text NOT NULL DEFAULT 'operational_improvement'::text,
  stage text NOT NULL DEFAULT 'discovered'::text,
  horizon text NOT NULL DEFAULT 'near_term'::text,
  target_customer text,
  target_industry text,
  problem text,
  proposed_solution text,
  revenue_model text,
  potential_value text,
  required_resources text,
  time_to_launch text,
  revenue_potential_score integer,
  strategic_fit_score integer,
  urgency_score integer,
  difficulty_score integer,
  speed_to_revenue_score integer,
  confidence_score integer,
  total_score numeric(5,1) GENERATED ALWAYS AS (round(((((((((COALESCE(revenue_potential_score, 5) + COALESCE(strategic_fit_score, 5)) + COALESCE(urgency_score, 5)) + (11 - COALESCE(difficulty_score, 5))) + COALESCE(speed_to_revenue_score, 5)))::numeric + ((COALESCE(confidence_score, 50))::numeric / 10.0)) / 6.0) * (10)::numeric), 1)) STORED,
  recommended_next_step text,
  validation_steps text,
  notes text,
  requires_review boolean NOT NULL DEFAULT true,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'viewer'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token text NOT NULL,
  client_id uuid,
  lead_id uuid,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  kind text NOT NULL,
  summary text NOT NULL DEFAULT ''::text,
  prepared_for text NOT NULL DEFAULT ''::text,
  implementation jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan_id uuid,
  alternative_plan_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  billing_frequency text NOT NULL DEFAULT 'monthly'::text,
  monthly_price_cents integer,
  annual_price_cents integer,
  setup_fee_cents integer NOT NULL DEFAULT 0,
  included_support text NOT NULL DEFAULT ''::text,
  service_level text NOT NULL DEFAULT ''::text,
  minimum_commitment_months integer NOT NULL DEFAULT 0,
  addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  contract_terms text NOT NULL DEFAULT ''::text,
  valid_until timestamp with time zone,
  sent_at timestamp with time zone,
  viewed_at timestamp with time zone,
  accepted_at timestamp with time zone,
  declined_at timestamp with time zone,
  accepted_scope jsonb,
  acceptance_name text NOT NULL DEFAULT ''::text,
  acceptance_email text NOT NULL DEFAULT ''::text,
  subscription_id uuid,
  created_by text NOT NULL DEFAULT ''::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qualification_forms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qualification_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  help_text text,
  question_type text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  point_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_points integer NOT NULL DEFAULT 0,
  parent_question_id uuid,
  show_when jsonb,
  service_ids jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qualification_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid,
  session_id uuid,
  form_id uuid,
  question_id uuid,
  question_key text NOT NULL,
  answer jsonb NOT NULL,
  points_earned integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qualification_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid,
  session_id uuid,
  rule_set_id uuid,
  rule_version integer,
  total_score integer NOT NULL DEFAULT 0,
  max_score integer NOT NULL DEFAULT 0,
  outcome text NOT NULL,
  priority text NOT NULL DEFAULT 'medium'::text,
  rule_hits jsonb NOT NULL DEFAULT '[]'::jsonb,
  score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  overridden_by text,
  override_outcome text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qualification_rule_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  min_qualifying_score integer NOT NULL DEFAULT 50,
  manual_review_min_score integer,
  manual_review_max_score integer,
  allow_calendar_on_manual_review boolean NOT NULL DEFAULT false,
  outcome_messages jsonb NOT NULL DEFAULT '{}'::jsonb,
  hard_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  service_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority_thresholds jsonb NOT NULL DEFAULT '{"low": 0, "high": 80, "medium": 50}'::jsonb,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qualification_rule_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reminder_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  appointment_type_id uuid,
  offset_minutes integer NOT NULL,
  channel text NOT NULL DEFAULT 'email'::text,
  enabled boolean NOT NULL DEFAULT true,
  template_key text NOT NULL DEFAULT 'reminder'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.risks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brief_id uuid,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium'::text,
  probability integer,
  potential_impact text,
  mitigation text,
  status text NOT NULL DEFAULT 'monitoring'::text,
  time_horizon text,
  last_reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_appointment_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  event_type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  confirmation_code text NOT NULL,
  consultation_type_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  contact_id uuid,
  lead_id uuid,
  call_id uuid,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  timezone text NOT NULL DEFAULT 'America/New_York'::text,
  status rsg_appointment_status NOT NULL DEFAULT 'scheduled'::rsg_appointment_status,
  reschedule_count integer NOT NULL DEFAULT 0,
  previous_starts_at timestamp with time zone,
  external_provider text,
  external_event_id text,
  external_sync_status text,
  notes text,
  cancellation_reason text,
  booked_via text NOT NULL DEFAULT 'phone_ai'::text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  actor_type text NOT NULL DEFAULT 'system'::text,
  actor_id text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  ip text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_business_hours (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid,
  day_of_week integer NOT NULL,
  opens_at time without time zone NOT NULL,
  closes_at time without time zone NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_call_turns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL,
  seq integer NOT NULL,
  role text NOT NULL,
  content text,
  tool_name text,
  tool_args jsonb,
  tool_result jsonb,
  latency_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_callback_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reference_code text NOT NULL,
  contact_id uuid,
  call_id uuid,
  phone text NOT NULL,
  reason text,
  preferred_window text,
  status text NOT NULL DEFAULT 'pending'::text,
  assigned_staff_id uuid,
  completed_at timestamp with time zone,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'twilio'::text,
  provider_call_id text,
  channel rsg_call_channel NOT NULL DEFAULT 'phone'::rsg_call_channel,
  direction rsg_call_direction NOT NULL DEFAULT 'inbound'::rsg_call_direction,
  from_number text,
  to_number text,
  status rsg_call_status NOT NULL DEFAULT 'in_progress'::rsg_call_status,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  duration_seconds integer,
  consent_recording boolean,
  recording_enabled boolean NOT NULL DEFAULT false,
  recording_sid text,
  recording_url text,
  recording_deleted_at timestamp with time zone,
  summary text,
  outcome rsg_call_outcome,
  sentiment text,
  escalation rsg_escalation NOT NULL DEFAULT 'none'::rsg_escalation,
  escalation_reason text,
  contact_id uuid,
  lead_id uuid,
  appointment_id uuid,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  turn_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  needs_review boolean NOT NULL DEFAULT false,
  review_reason text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL,
  consent_type text NOT NULL DEFAULT 'recording'::text,
  granted boolean NOT NULL,
  method text NOT NULL DEFAULT 'ivr_disclosure'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_consultation_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  caller_pitch text,
  duration_minutes integer NOT NULL DEFAULT 30,
  buffer_before_minutes integer NOT NULL DEFAULT 0,
  buffer_after_minutes integer NOT NULL DEFAULT 15,
  min_notice_hours integer NOT NULL DEFAULT 4,
  max_advance_days integer NOT NULL DEFAULT 30,
  slot_granularity_minutes integer NOT NULL DEFAULT 30,
  default_staff_id uuid,
  meeting_mode text NOT NULL DEFAULT 'phone'::text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  full_name text,
  business_name text,
  phone_primary text,
  phone_alt text,
  email text,
  website text,
  industry text,
  location text,
  employee_count integer,
  location_count integer,
  source text NOT NULL DEFAULT 'phone'::text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  is_client boolean NOT NULL DEFAULT false,
  client_plan text,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_external_busy (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid,
  source text NOT NULL,
  external_id text,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  synced_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL,
  name text NOT NULL,
  staff_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_integration_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text NOT NULL,
  provider text NOT NULL,
  display_name text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT false,
  last_ok_at timestamp with time zone,
  last_error text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status rsg_job_status NOT NULL DEFAULT 'pending'::rsg_job_status,
  run_at timestamp with time zone NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  idempotency_key text,
  last_error text,
  locked_at timestamp with time zone,
  locked_by text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_lead_scoring_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  factor text NOT NULL,
  description text,
  field text NOT NULL,
  operator text NOT NULL,
  value jsonb,
  points integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contact_id uuid,
  status rsg_lead_status NOT NULL DEFAULT 'new'::rsg_lead_status,
  classification rsg_lead_classification,
  score integer NOT NULL DEFAULT 0,
  primary_problem text,
  desired_outcome text,
  recommended_package text,
  recommended_consultation_type_id uuid,
  current_software text,
  timeline text,
  budget_range text,
  decision_role text,
  urgency text,
  qualification jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  source_call_id uuid,
  assigned_staff_id uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_message_templates (
  key text NOT NULL,
  channel rsg_message_channel NOT NULL,
  name text,
  subject text,
  body text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contact_id uuid,
  call_id uuid,
  appointment_id uuid,
  channel rsg_message_channel NOT NULL,
  direction rsg_message_direction NOT NULL DEFAULT 'outbound'::rsg_message_direction,
  to_address text NOT NULL,
  from_address text,
  subject text,
  body text NOT NULL,
  template_key text,
  status rsg_message_status NOT NULL DEFAULT 'queued'::rsg_message_status,
  provider text,
  provider_message_id text,
  error text,
  sent_at timestamp with time zone,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid,
  severity rsg_priority NOT NULL DEFAULT 'normal'::rsg_priority,
  title text NOT NULL,
  body text,
  entity_type text,
  entity_id uuid,
  action_url text,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service_id uuid,
  label text NOT NULL,
  starting_price_cents integer,
  currency text NOT NULL DEFAULT 'USD'::text,
  display_enabled boolean NOT NULL DEFAULT false,
  notes text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_qualification_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  qkey text NOT NULL,
  question text NOT NULL,
  purpose text,
  applies_to text[] NOT NULL DEFAULT '{}'::text[],
  ask_priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_rate_limits (
  rl_key text NOT NULL,
  window_start timestamp with time zone NOT NULL,
  count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.rsg_schedule_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  category text,
  package text NOT NULL,
  short_pitch text,
  description text,
  routing_keywords text[] NOT NULL DEFAULT '{}'::text[],
  default_consultation_slug text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.rsg_staff (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  full_name text NOT NULL,
  title text,
  role rsg_staff_role NOT NULL DEFAULT 'staff'::rsg_staff_role,
  phone text,
  timezone text NOT NULL DEFAULT 'America/New_York'::text,
  website_team_member_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  require_mfa boolean NOT NULL DEFAULT false,
  notify_email boolean NOT NULL DEFAULT true,
  notify_sms boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_staff_consultation_types (
  staff_id uuid NOT NULL,
  consultation_type_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rsg_support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reference_code text NOT NULL,
  contact_id uuid,
  call_id uuid,
  subject text NOT NULL,
  description text,
  priority rsg_priority NOT NULL DEFAULT 'normal'::rsg_priority,
  status rsg_ticket_status NOT NULL DEFAULT 'open'::rsg_ticket_status,
  assigned_staff_id uuid,
  resolved_at timestamp with time zone,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_tool_invocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  call_id uuid,
  tool text NOT NULL,
  status text NOT NULL,
  error text,
  latency_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contact_id uuid,
  consultation_type_id uuid,
  earliest timestamp with time zone,
  latest timestamp with time zone,
  status text NOT NULL DEFAULT 'active'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsg_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  payload jsonb,
  signature_valid boolean,
  status text NOT NULL DEFAULT 'received'::text,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  error text
);

CREATE TABLE IF NOT EXISTS public.scheduling_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  lead_id uuid,
  booking_id uuid,
  action text NOT NULL,
  actor text NOT NULL DEFAULT 'system'::text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scheduling_analytics_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  session_id uuid,
  lead_id uuid,
  booking_id uuid,
  service_id uuid,
  appointment_type_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scheduling_settings (
  id text NOT NULL DEFAULT 'default'::text,
  admin_timezone text NOT NULL DEFAULT 'America/New_York'::text,
  internal_notification_emails jsonb NOT NULL DEFAULT '["contact@redmontstrategiesgroup.com"]'::jsonb,
  sender_name text NOT NULL DEFAULT 'Redmont Strategies Group'::text,
  reply_to text NOT NULL DEFAULT 'contact@redmontstrategiesgroup.com'::text,
  bookings_paused boolean NOT NULL DEFAULT false,
  abandon_hours integer NOT NULL DEFAULT 24,
  max_follow_ups integer NOT NULL DEFAULT 1,
  cancel_cutoff_minutes integer NOT NULL DEFAULT 240,
  reschedule_cutoff_minutes integer NOT NULL DEFAULT 240,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  subscription_id uuid,
  kind text NOT NULL DEFAULT 'monthly'::text,
  title text NOT NULL,
  period_start date,
  period_end date,
  status text NOT NULL DEFAULT 'draft'::text,
  summary text NOT NULL DEFAULT ''::text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamp with time zone,
  created_by text NOT NULL DEFAULT ''::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  subscription_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  details text NOT NULL DEFAULT ''::text,
  status text NOT NULL DEFAULT 'new'::text,
  priority text NOT NULL DEFAULT 'standard'::text,
  inclusion text NOT NULL DEFAULT 'pending_assessment'::text,
  acknowledged_consequences boolean NOT NULL DEFAULT false,
  estimated_hours numeric(6,2),
  actual_hours numeric(6,2),
  extra_charge_cents integer,
  response_due_at timestamp with time zone,
  resolved_at timestamp with time zone,
  admin_notes text NOT NULL DEFAULT ''::text,
  activity jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid NOT NULL,
  client_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone,
  user_agent text,
  ip text
);

CREATE TABLE IF NOT EXISTS public.sources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  publisher text,
  author text,
  url text,
  source_type text NOT NULL DEFAULT 'other'::text,
  credibility_level text NOT NULL DEFAULT 'unclassified'::text,
  publication_date date,
  accessed_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid,
  client_id uuid,
  type text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  actor text NOT NULL DEFAULT 'system'::text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  stripe_event_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid,
  client_id uuid,
  stripe_invoice_id text,
  invoice_number text NOT NULL DEFAULT ''::text,
  description text NOT NULL DEFAULT ''::text,
  amount_due_cents integer NOT NULL DEFAULT 0,
  amount_paid_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd'::text,
  status text NOT NULL DEFAULT 'open'::text,
  hosted_invoice_url text NOT NULL DEFAULT ''::text,
  invoice_pdf_url text NOT NULL DEFAULT ''::text,
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  issued_at timestamp with time zone,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  category text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/New_York'::text,
  role text NOT NULL DEFAULT 'consultant'::text,
  color text NOT NULL DEFAULT '#b3243a'::text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  attempts integer NOT NULL DEFAULT 0,
  response_status integer,
  last_error text,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  delivered_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  url text NOT NULL,
  secret text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);


-- ============ CONSTRAINTS (PK / UNIQUE / CHECK / EXCLUDE, then FK) ============

ALTER TABLE public.action_items ADD CONSTRAINT action_items_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_generations ADD CONSTRAINT ai_generations_pkey PRIMARY KEY (id);
ALTER TABLE public.appointment_types ADD CONSTRAINT appointment_types_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_admin_audit_log ADD CONSTRAINT audit_admin_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_admin_notes ADD CONSTRAINT audit_admin_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_admin_users ADD CONSTRAINT audit_admin_users_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_analytics_events ADD CONSTRAINT audit_analytics_events_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_answers ADD CONSTRAINT audit_answers_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_booking_activity ADD CONSTRAINT audit_booking_activity_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_businesses ADD CONSTRAINT audit_businesses_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_consent_records ADD CONSTRAINT audit_consent_records_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_contacts ADD CONSTRAINT audit_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_email_deliveries ADD CONSTRAINT audit_email_deliveries_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_reports ADD CONSTRAINT audit_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_scoring_overrides ADD CONSTRAINT audit_scoring_overrides_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_sessions ADD CONSTRAINT audit_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_website_scans ADD CONSTRAINT audit_website_scans_pkey PRIMARY KEY (id);
ALTER TABLE public.availability_schedules ADD CONSTRAINT availability_schedules_pkey PRIMARY KEY (id);
ALTER TABLE public.availability_windows ADD CONSTRAINT availability_windows_pkey PRIMARY KEY (id);
ALTER TABLE public.booking_attendees ADD CONSTRAINT booking_attendees_pkey PRIMARY KEY (id);
ALTER TABLE public.booking_changes ADD CONSTRAINT booking_changes_pkey PRIMARY KEY (id);
ALTER TABLE public.booking_sessions ADD CONSTRAINT booking_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.bookings ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);
ALTER TABLE public.brief_sections ADD CONSTRAINT brief_sections_pkey PRIMARY KEY (id);
ALTER TABLE public.brief_sources ADD CONSTRAINT brief_sources_pkey PRIMARY KEY (brief_id, source_id);
ALTER TABLE public.briefs ADD CONSTRAINT briefs_pkey PRIMARY KEY (id);
ALTER TABLE public.calendar_blocks ADD CONSTRAINT calendar_blocks_pkey PRIMARY KEY (id);
ALTER TABLE public.calendar_integrations ADD CONSTRAINT calendar_integrations_pkey PRIMARY KEY (id);
ALTER TABLE public.client_roadmaps ADD CONSTRAINT client_roadmaps_pkey PRIMARY KEY (id);
ALTER TABLE public.client_subscriptions ADD CONSTRAINT client_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
ALTER TABLE public.consent_records ADD CONSTRAINT consent_records_pkey PRIMARY KEY (id);
ALTER TABLE public.dashboard_preferences ADD CONSTRAINT dashboard_preferences_pkey PRIMARY KEY (user_id);
ALTER TABLE public.entity_tags ADD CONSTRAINT entity_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.ideas ADD CONSTRAINT ideas_pkey PRIMARY KEY (id);
ALTER TABLE public.ingestion_logs ADD CONSTRAINT ingestion_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.integrations ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);
ALTER TABLE public.intelligence_items ADD CONSTRAINT intelligence_items_pkey PRIMARY KEY (id);
ALTER TABLE public.leads ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE public.maintenance_logs ADD CONSTRAINT maintenance_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.managed_service_plans ADD CONSTRAINT managed_service_plans_pkey PRIMARY KEY (id);
ALTER TABLE public.meeting_locations ADD CONSTRAINT meeting_locations_pkey PRIMARY KEY (id);
ALTER TABLE public.notes ADD CONSTRAINT notes_pkey PRIMARY KEY (id);
ALTER TABLE public.notification_deliveries ADD CONSTRAINT notification_deliveries_pkey PRIMARY KEY (id);
ALTER TABLE public.notification_jobs ADD CONSTRAINT notification_jobs_pkey PRIMARY KEY (id);
ALTER TABLE public.notification_templates ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.proposals ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);
ALTER TABLE public.qualification_forms ADD CONSTRAINT qualification_forms_pkey PRIMARY KEY (id);
ALTER TABLE public.qualification_questions ADD CONSTRAINT qualification_questions_pkey PRIMARY KEY (id);
ALTER TABLE public.qualification_responses ADD CONSTRAINT qualification_responses_pkey PRIMARY KEY (id);
ALTER TABLE public.qualification_results ADD CONSTRAINT qualification_results_pkey PRIMARY KEY (id);
ALTER TABLE public.qualification_rule_sets ADD CONSTRAINT qualification_rule_sets_pkey PRIMARY KEY (id);
ALTER TABLE public.qualification_rule_versions ADD CONSTRAINT qualification_rule_versions_pkey PRIMARY KEY (id);
ALTER TABLE public.reminder_schedules ADD CONSTRAINT reminder_schedules_pkey PRIMARY KEY (id);
ALTER TABLE public.risks ADD CONSTRAINT risks_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_appointment_events ADD CONSTRAINT rsg_appointment_events_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_appointments ADD CONSTRAINT rsg_appointments_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_audit_log ADD CONSTRAINT rsg_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_business_hours ADD CONSTRAINT rsg_business_hours_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_call_turns ADD CONSTRAINT rsg_call_turns_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_callback_requests ADD CONSTRAINT rsg_callback_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_calls ADD CONSTRAINT rsg_calls_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_consents ADD CONSTRAINT rsg_consents_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_consultation_types ADD CONSTRAINT rsg_consultation_types_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_contacts ADD CONSTRAINT rsg_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_external_busy ADD CONSTRAINT rsg_external_busy_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_holidays ADD CONSTRAINT rsg_holidays_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_integration_settings ADD CONSTRAINT rsg_integration_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_jobs ADD CONSTRAINT rsg_jobs_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_lead_scoring_rules ADD CONSTRAINT rsg_lead_scoring_rules_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_leads ADD CONSTRAINT rsg_leads_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_message_templates ADD CONSTRAINT rsg_message_templates_pkey PRIMARY KEY (key);
ALTER TABLE public.rsg_messages ADD CONSTRAINT rsg_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_notifications ADD CONSTRAINT rsg_notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_pricing ADD CONSTRAINT rsg_pricing_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_qualification_questions ADD CONSTRAINT rsg_qualification_questions_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_rate_limits ADD CONSTRAINT rsg_rate_limits_pkey PRIMARY KEY (rl_key);
ALTER TABLE public.rsg_schedule_blocks ADD CONSTRAINT rsg_schedule_blocks_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_services ADD CONSTRAINT rsg_services_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_settings ADD CONSTRAINT rsg_settings_pkey PRIMARY KEY (key);
ALTER TABLE public.rsg_staff ADD CONSTRAINT rsg_staff_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_staff_consultation_types ADD CONSTRAINT rsg_staff_consultation_types_pkey PRIMARY KEY (staff_id, consultation_type_id);
ALTER TABLE public.rsg_support_tickets ADD CONSTRAINT rsg_support_tickets_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_tool_invocations ADD CONSTRAINT rsg_tool_invocations_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_waitlist ADD CONSTRAINT rsg_waitlist_pkey PRIMARY KEY (id);
ALTER TABLE public.rsg_webhook_events ADD CONSTRAINT rsg_webhook_events_pkey PRIMARY KEY (id);
ALTER TABLE public.scheduling_activity_logs ADD CONSTRAINT scheduling_activity_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.scheduling_analytics_events ADD CONSTRAINT scheduling_analytics_events_pkey PRIMARY KEY (id);
ALTER TABLE public.scheduling_settings ADD CONSTRAINT scheduling_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.service_reports ADD CONSTRAINT service_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.services ADD CONSTRAINT services_pkey PRIMARY KEY (id);
ALTER TABLE public.sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.sources ADD CONSTRAINT sources_pkey PRIMARY KEY (id);
ALTER TABLE public.subscription_events ADD CONSTRAINT subscription_events_pkey PRIMARY KEY (id);
ALTER TABLE public.subscription_invoices ADD CONSTRAINT subscription_invoices_pkey PRIMARY KEY (id);
ALTER TABLE public.tags ADD CONSTRAINT tags_pkey PRIMARY KEY (id);
ALTER TABLE public.team_members ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);
ALTER TABLE public.webhook_deliveries ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id);
ALTER TABLE public.webhook_endpoints ADD CONSTRAINT webhook_endpoints_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_admin_users ADD CONSTRAINT audit_admin_users_email_key UNIQUE (email);
ALTER TABLE public.audit_answers ADD CONSTRAINT audit_answers_session_id_question_key_key UNIQUE (session_id, question_key);
ALTER TABLE public.audit_businesses ADD CONSTRAINT audit_businesses_session_id_key UNIQUE (session_id);
ALTER TABLE public.audit_contacts ADD CONSTRAINT audit_contacts_session_id_key UNIQUE (session_id);
ALTER TABLE public.audit_reports ADD CONSTRAINT audit_reports_access_token_key UNIQUE (access_token);
ALTER TABLE public.audit_reports ADD CONSTRAINT audit_reports_session_id_key UNIQUE (session_id);
ALTER TABLE public.audit_sessions ADD CONSTRAINT audit_sessions_resume_token_key UNIQUE (resume_token);
ALTER TABLE public.audit_website_scans ADD CONSTRAINT audit_website_scans_session_id_key UNIQUE (session_id);
ALTER TABLE public.briefs ADD CONSTRAINT briefs_slug_brief_date_key UNIQUE (slug, brief_date);
ALTER TABLE public.entity_tags ADD CONSTRAINT entity_tags_tag_id_entity_type_entity_id_key UNIQUE (tag_id, entity_type, entity_id);
ALTER TABLE public.ingestion_logs ADD CONSTRAINT ingestion_logs_idempotency_key_key UNIQUE (idempotency_key);
ALTER TABLE public.managed_service_plans ADD CONSTRAINT managed_service_plans_key_key UNIQUE (key);
ALTER TABLE public.proposals ADD CONSTRAINT proposals_token_key UNIQUE (token);
ALTER TABLE public.qualification_rule_versions ADD CONSTRAINT qualification_rule_versions_rule_set_id_version_key UNIQUE (rule_set_id, version);
ALTER TABLE public.rsg_appointments ADD CONSTRAINT rsg_appointments_confirmation_code_key UNIQUE (confirmation_code);
ALTER TABLE public.rsg_call_turns ADD CONSTRAINT rsg_call_turns_call_id_seq_key UNIQUE (call_id, seq);
ALTER TABLE public.rsg_callback_requests ADD CONSTRAINT rsg_callback_requests_reference_code_key UNIQUE (reference_code);
ALTER TABLE public.rsg_calls ADD CONSTRAINT rsg_calls_provider_call_id_key UNIQUE (provider_call_id);
ALTER TABLE public.rsg_consultation_types ADD CONSTRAINT rsg_consultation_types_slug_key UNIQUE (slug);
ALTER TABLE public.rsg_external_busy ADD CONSTRAINT rsg_external_busy_source_external_id_key UNIQUE (source, external_id);
ALTER TABLE public.rsg_integration_settings ADD CONSTRAINT rsg_integration_settings_category_provider_key UNIQUE (category, provider);
ALTER TABLE public.rsg_qualification_questions ADD CONSTRAINT rsg_qualification_questions_qkey_key UNIQUE (qkey);
ALTER TABLE public.rsg_services ADD CONSTRAINT rsg_services_slug_key UNIQUE (slug);
ALTER TABLE public.rsg_staff ADD CONSTRAINT rsg_staff_email_key UNIQUE (email);
ALTER TABLE public.rsg_staff ADD CONSTRAINT rsg_staff_user_id_key UNIQUE (user_id);
ALTER TABLE public.rsg_support_tickets ADD CONSTRAINT rsg_support_tickets_reference_code_key UNIQUE (reference_code);
ALTER TABLE public.rsg_webhook_events ADD CONSTRAINT rsg_webhook_events_provider_event_id_key UNIQUE (provider, event_id);
ALTER TABLE public.tags ADD CONSTRAINT tags_slug_key UNIQUE (slug);
ALTER TABLE public.bookings ADD CONSTRAINT bookings_no_overlap EXCLUDE USING gist (team_member_id WITH =, tstzrange(starts_at, ends_at, '[)'::text) WITH &&) WHERE (((status = ANY (ARRAY['confirmed'::text, 'rescheduled'::text])) AND (team_member_id IS NOT NULL)));
ALTER TABLE public.rsg_appointments ADD CONSTRAINT rsg_appointments_no_overlap EXCLUDE USING gist (staff_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE ((status = ANY (ARRAY['scheduled'::rsg_appointment_status, 'confirmed'::rsg_appointment_status])));
ALTER TABLE public.action_items ADD CONSTRAINT action_items_effort_score_check CHECK (((effort_score >= 1) AND (effort_score <= 10)));
ALTER TABLE public.action_items ADD CONSTRAINT action_items_impact_score_check CHECK (((impact_score >= 1) AND (impact_score <= 10)));
ALTER TABLE public.action_items ADD CONSTRAINT action_items_priority_check CHECK ((priority = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text])));
ALTER TABLE public.action_items ADD CONSTRAINT action_items_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewing'::text, 'planned'::text, 'in_progress'::text, 'blocked'::text, 'completed'::text, 'dismissed'::text])));
ALTER TABLE public.ai_generations ADD CONSTRAINT ai_generations_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'edited'::text, 'rejected'::text, 'dismissed'::text])));
ALTER TABLE public.ai_generations ADD CONSTRAINT ai_generations_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100)));
ALTER TABLE public.audit_scoring_overrides ADD CONSTRAINT audit_scoring_overrides_id_check CHECK ((id = 1));
ALTER TABLE public.availability_windows ADD CONSTRAINT availability_windows_check CHECK ((((day_of_week IS NOT NULL) AND (specific_date IS NULL)) OR ((day_of_week IS NULL) AND (specific_date IS NOT NULL))));
ALTER TABLE public.availability_windows ADD CONSTRAINT availability_windows_check1 CHECK ((end_time > start_time));
ALTER TABLE public.availability_windows ADD CONSTRAINT availability_windows_day_of_week_check CHECK (((day_of_week IS NULL) OR ((day_of_week >= 0) AND (day_of_week <= 6))));
ALTER TABLE public.booking_attendees ADD CONSTRAINT booking_attendees_role_check CHECK ((role = ANY (ARRAY['visitor'::text, 'host'::text, 'guest'::text])));
ALTER TABLE public.booking_changes ADD CONSTRAINT booking_changes_change_type_check CHECK ((change_type = ANY (ARRAY['created'::text, 'rescheduled'::text, 'cancelled'::text, 'completed'::text, 'no_show'::text, 'notes_updated'::text, 'format_updated'::text])));
ALTER TABLE public.bookings ADD CONSTRAINT bookings_check CHECK ((ends_at > starts_at));
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check CHECK ((status = ANY (ARRAY['confirmed'::text, 'rescheduled'::text, 'cancelled'::text, 'completed'::text, 'no_show'::text])));
ALTER TABLE public.brief_sections ADD CONSTRAINT brief_sections_position_check CHECK (("position" >= 0));
ALTER TABLE public.briefs ADD CONSTRAINT briefs_priority_check CHECK ((priority = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text])));
ALTER TABLE public.briefs ADD CONSTRAINT briefs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])));
ALTER TABLE public.briefs ADD CONSTRAINT briefs_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 240)));
ALTER TABLE public.calendar_blocks ADD CONSTRAINT calendar_blocks_block_type_check CHECK ((block_type = ANY (ARRAY['blackout'::text, 'holiday'::text, 'vacation'::text, 'break'::text, 'manual'::text])));
ALTER TABLE public.calendar_blocks ADD CONSTRAINT calendar_blocks_check CHECK ((ends_at > starts_at));
ALTER TABLE public.calendar_integrations ADD CONSTRAINT calendar_integrations_status_check CHECK ((status = ANY (ARRAY['not_connected'::text, 'connected'::text, 'error'::text, 'disabled'::text])));
ALTER TABLE public.client_roadmaps ADD CONSTRAINT client_roadmaps_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'proposed'::text, 'approved'::text, 'in_progress'::text, 'completed'::text])));
ALTER TABLE public.client_subscriptions ADD CONSTRAINT client_subscriptions_billing_frequency_check CHECK ((billing_frequency = ANY (ARRAY['monthly'::text, 'annual'::text])));
ALTER TABLE public.client_subscriptions ADD CONSTRAINT client_subscriptions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'awaiting_payment'::text, 'active'::text, 'past_due'::text, 'paused'::text, 'pending_cancellation'::text, 'cancelled'::text])));
ALTER TABLE public.entity_tags ADD CONSTRAINT entity_tags_entity_type_check CHECK ((entity_type = ANY (ARRAY['brief'::text, 'intelligence'::text, 'action'::text, 'opportunity'::text, 'risk'::text, 'idea'::text, 'source'::text])));
ALTER TABLE public.ideas ADD CONSTRAINT ideas_status_check CHECK ((status = ANY (ARRAY['captured'::text, 'reviewing'::text, 'validated'::text, 'building'::text, 'shipped'::text, 'dismissed'::text])));
ALTER TABLE public.ingestion_logs ADD CONSTRAINT ingestion_logs_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'succeeded'::text, 'duplicate'::text, 'failed'::text])));
ALTER TABLE public.integrations ADD CONSTRAINT integrations_integration_type_check CHECK ((integration_type = ANY (ARRAY['webhook'::text, 'email'::text, 'gmail'::text, 'google_calendar'::text, 'database'::text, 'api'::text, 'n8n'::text, 'make'::text, 'zapier'::text, 'custom'::text])));
ALTER TABLE public.integrations ADD CONSTRAINT integrations_status_check CHECK ((status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'disabled'::text, 'error'::text])));
ALTER TABLE public.intelligence_items ADD CONSTRAINT intelligence_items_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100)));
ALTER TABLE public.intelligence_items ADD CONSTRAINT intelligence_items_urgency_check CHECK ((urgency = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text])));
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'qualified'::text, 'meeting_scheduled'::text, 'won'::text, 'lost'::text, 'spam'::text, 'archived'::text, 'intake_started'::text, 'intake_abandoned'::text, 'submitted'::text, 'qualified_not_booked'::text, 'appointment_booked'::text, 'manual_review'::text, 'not_eligible'::text, 'rescheduled'::text, 'cancelled'::text, 'no_show'::text, 'completed'::text, 'follow_up_required'::text, 'converted'::text, 'closed'::text])));
ALTER TABLE public.maintenance_logs ADD CONSTRAINT maintenance_logs_category_check CHECK ((category = ANY (ARRAY['maintenance'::text, 'update'::text, 'backup'::text, 'security'::text, 'monitoring'::text, 'fix'::text, 'improvement'::text, 'development'::text, 'automation'::text, 'ai'::text, 'infrastructure'::text, 'other'::text])));
ALTER TABLE public.meeting_locations ADD CONSTRAINT meeting_locations_location_type_check CHECK ((location_type = ANY (ARRAY['phone'::text, 'google_meet'::text, 'zoom'::text, 'microsoft_teams'::text, 'in_person'::text, 'custom_link'::text, 'custom_location'::text])));
ALTER TABLE public.notes ADD CONSTRAINT notes_check CHECK ((num_nonnulls(brief_id, intelligence_item_id, action_item_id, opportunity_id) <= 1));
ALTER TABLE public.notes ADD CONSTRAINT notes_content_check CHECK (((char_length(content) >= 1) AND (char_length(content) <= 10000)));
ALTER TABLE public.notification_deliveries ADD CONSTRAINT notification_deliveries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])));
ALTER TABLE public.notification_jobs ADD CONSTRAINT notification_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])));
ALTER TABLE public.notification_templates ADD CONSTRAINT notification_templates_audience_check CHECK ((audience = ANY (ARRAY['visitor'::text, 'internal'::text])));
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_confidence_score_check CHECK (((confidence_score >= 0) AND (confidence_score <= 100)));
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_difficulty_score_check CHECK (((difficulty_score >= 1) AND (difficulty_score <= 10)));
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_horizon_check CHECK ((horizon = ANY (ARRAY['immediate'::text, 'near_term'::text, 'long_term'::text, 'experimental'::text])));
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_revenue_potential_score_check CHECK (((revenue_potential_score >= 1) AND (revenue_potential_score <= 10)));
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_speed_to_revenue_score_check CHECK (((speed_to_revenue_score >= 1) AND (speed_to_revenue_score <= 10)));
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_stage_check CHECK ((stage = ANY (ARRAY['discovered'::text, 'reviewing'::text, 'validating'::text, 'approved'::text, 'building'::text, 'launched'::text, 'paused'::text, 'rejected'::text])));
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_strategic_fit_score_check CHECK (((strategic_fit_score >= 1) AND (strategic_fit_score <= 10)));
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_urgency_score_check CHECK (((urgency_score >= 1) AND (urgency_score <= 10)));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'viewer'::text])));
ALTER TABLE public.proposals ADD CONSTRAINT proposals_billing_frequency_check CHECK ((billing_frequency = ANY (ARRAY['monthly'::text, 'annual'::text])));
ALTER TABLE public.proposals ADD CONSTRAINT proposals_kind_check CHECK ((kind = ANY (ARRAY['implementation'::text, 'monthly_service'::text, 'implementation_plus_monthly'::text, 'project_completion'::text])));
ALTER TABLE public.proposals ADD CONSTRAINT proposals_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'viewed'::text, 'accepted'::text, 'declined'::text, 'expired'::text])));
ALTER TABLE public.qualification_questions ADD CONSTRAINT qualification_questions_question_type_check CHECK ((question_type = ANY (ARRAY['short_text'::text, 'long_text'::text, 'multiple_choice'::text, 'checkboxes'::text, 'dropdown'::text, 'yes_no'::text, 'number'::text, 'currency'::text, 'date'::text, 'rating'::text, 'conditional'::text])));
ALTER TABLE public.qualification_results ADD CONSTRAINT qualification_results_outcome_check CHECK ((outcome = ANY (ARRAY['qualified'::text, 'manual_review'::text, 'not_eligible'::text])));
ALTER TABLE public.qualification_results ADD CONSTRAINT qualification_results_priority_check CHECK ((priority = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])));
ALTER TABLE public.qualification_rule_sets ADD CONSTRAINT qualification_rule_sets_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])));
ALTER TABLE public.reminder_schedules ADD CONSTRAINT reminder_schedules_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text])));
ALTER TABLE public.risks ADD CONSTRAINT risks_probability_check CHECK (((probability >= 0) AND (probability <= 100)));
ALTER TABLE public.risks ADD CONSTRAINT risks_severity_check CHECK ((severity = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text])));
ALTER TABLE public.risks ADD CONSTRAINT risks_status_check CHECK ((status = ANY (ARRAY['active'::text, 'monitoring'::text, 'mitigated'::text, 'accepted'::text, 'closed'::text])));
ALTER TABLE public.rsg_appointments ADD CONSTRAINT rsg_appointments_check CHECK ((ends_at > starts_at));
ALTER TABLE public.rsg_business_hours ADD CONSTRAINT rsg_business_hours_check CHECK ((closes_at > opens_at));
ALTER TABLE public.rsg_business_hours ADD CONSTRAINT rsg_business_hours_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)));
ALTER TABLE public.rsg_call_turns ADD CONSTRAINT rsg_call_turns_role_check CHECK ((role = ANY (ARRAY['assistant'::text, 'caller'::text, 'system'::text, 'tool'::text])));
ALTER TABLE public.rsg_callback_requests ADD CONSTRAINT rsg_callback_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE public.rsg_consultation_types ADD CONSTRAINT rsg_consultation_types_buffer_after_minutes_check CHECK ((buffer_after_minutes >= 0));
ALTER TABLE public.rsg_consultation_types ADD CONSTRAINT rsg_consultation_types_buffer_before_minutes_check CHECK ((buffer_before_minutes >= 0));
ALTER TABLE public.rsg_consultation_types ADD CONSTRAINT rsg_consultation_types_duration_minutes_check CHECK (((duration_minutes >= 5) AND (duration_minutes <= 480)));
ALTER TABLE public.rsg_consultation_types ADD CONSTRAINT rsg_consultation_types_max_advance_days_check CHECK (((max_advance_days >= 1) AND (max_advance_days <= 365)));
ALTER TABLE public.rsg_consultation_types ADD CONSTRAINT rsg_consultation_types_min_notice_hours_check CHECK ((min_notice_hours >= 0));
ALTER TABLE public.rsg_consultation_types ADD CONSTRAINT rsg_consultation_types_slot_granularity_minutes_check CHECK ((slot_granularity_minutes = ANY (ARRAY[10, 15, 20, 30, 60])));
ALTER TABLE public.rsg_lead_scoring_rules ADD CONSTRAINT rsg_lead_scoring_rules_operator_check CHECK ((operator = ANY (ARRAY['equals'::text, 'not_equals'::text, 'in'::text, 'contains'::text, 'gte'::text, 'lte'::text, 'between'::text, 'exists'::text, 'truthy'::text, 'count_gte'::text])));
ALTER TABLE public.rsg_pricing ADD CONSTRAINT rsg_pricing_starting_price_cents_check CHECK (((starting_price_cents IS NULL) OR (starting_price_cents >= 0)));
ALTER TABLE public.rsg_schedule_blocks ADD CONSTRAINT rsg_schedule_blocks_check CHECK ((ends_at > starts_at));
ALTER TABLE public.rsg_services ADD CONSTRAINT rsg_services_package_check CHECK ((package = ANY (ARRAY['foundation'::text, 'growth'::text, 'operations'::text, 'private_ai'::text, 'custom'::text])));
ALTER TABLE public.rsg_tool_invocations ADD CONSTRAINT rsg_tool_invocations_status_check CHECK ((status = ANY (ARRAY['ok'::text, 'rejected'::text, 'error'::text])));
ALTER TABLE public.rsg_waitlist ADD CONSTRAINT rsg_waitlist_status_check CHECK ((status = ANY (ARRAY['active'::text, 'fulfilled'::text, 'expired'::text, 'cancelled'::text])));
ALTER TABLE public.rsg_webhook_events ADD CONSTRAINT rsg_webhook_events_status_check CHECK ((status = ANY (ARRAY['received'::text, 'processed'::text, 'skipped'::text, 'error'::text])));
ALTER TABLE public.service_reports ADD CONSTRAINT service_reports_kind_check CHECK ((kind = ANY (ARRAY['monthly'::text, 'health'::text, 'baseline'::text, 'quarterly'::text])));
ALTER TABLE public.service_reports ADD CONSTRAINT service_reports_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])));
ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_inclusion_check CHECK ((inclusion = ANY (ARRAY['included'::text, 'needs_approval'::text, 'extra_charge'::text, 'pending_assessment'::text])));
ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_priority_check CHECK ((priority = ANY (ARRAY['standard'::text, 'priority'::text, 'urgent'::text])));
ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_status_check CHECK ((status = ANY (ARRAY['new'::text, 'in_review'::text, 'approved'::text, 'scheduled'::text, 'in_progress'::text, 'waiting_on_client'::text, 'completed'::text, 'declined'::text])));
ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_type_check CHECK ((type = ANY (ARRAY['technical_issue'::text, 'website_change'::text, 'crm_change'::text, 'automation_request'::text, 'ai_knowledge_update'::text, 'new_integration'::text, 'reporting_request'::text, 'security_concern'::text, 'infrastructure_issue'::text, 'strategy_request'::text, 'plan_change'::text, 'cancellation_request'::text, 'additional_work'::text, 'review_request'::text, 'general'::text])));
ALTER TABLE public.sources ADD CONSTRAINT sources_credibility_level_check CHECK ((credibility_level = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text, 'unclassified'::text])));
ALTER TABLE public.sources ADD CONSTRAINT sources_source_type_check CHECK ((source_type = ANY (ARRAY['company_website'::text, 'government'::text, 'research_report'::text, 'news_publication'::text, 'industry_publication'::text, 'social_media'::text, 'podcast'::text, 'video'::text, 'financial_filing'::text, 'local_publication'::text, 'other'::text])));
ALTER TABLE public.webhook_deliveries ADD CONSTRAINT webhook_deliveries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'delivered'::text, 'failed'::text])));
ALTER TABLE public.action_items ADD CONSTRAINT action_items_brief_id_fkey FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE SET NULL;
ALTER TABLE public.action_items ADD CONSTRAINT action_items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.appointment_types ADD CONSTRAINT appointment_types_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE public.appointment_types ADD CONSTRAINT appointment_types_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL;
ALTER TABLE public.audit_admin_notes ADD CONSTRAINT audit_admin_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES audit_admin_users(id);
ALTER TABLE public.audit_admin_notes ADD CONSTRAINT audit_admin_notes_session_id_fkey FOREIGN KEY (session_id) REFERENCES audit_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.audit_analytics_events ADD CONSTRAINT audit_analytics_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES audit_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.audit_answers ADD CONSTRAINT audit_answers_session_id_fkey FOREIGN KEY (session_id) REFERENCES audit_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.audit_booking_activity ADD CONSTRAINT audit_booking_activity_session_id_fkey FOREIGN KEY (session_id) REFERENCES audit_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.audit_businesses ADD CONSTRAINT audit_businesses_session_id_fkey FOREIGN KEY (session_id) REFERENCES audit_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.audit_consent_records ADD CONSTRAINT audit_consent_records_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES audit_contacts(id) ON DELETE CASCADE;
ALTER TABLE public.audit_consent_records ADD CONSTRAINT audit_consent_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES audit_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.audit_contacts ADD CONSTRAINT audit_contacts_session_id_fkey FOREIGN KEY (session_id) REFERENCES audit_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.audit_email_deliveries ADD CONSTRAINT audit_email_deliveries_session_id_fkey FOREIGN KEY (session_id) REFERENCES audit_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.audit_reports ADD CONSTRAINT audit_reports_session_id_fkey FOREIGN KEY (session_id) REFERENCES audit_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.audit_website_scans ADD CONSTRAINT audit_website_scans_session_id_fkey FOREIGN KEY (session_id) REFERENCES audit_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.availability_schedules ADD CONSTRAINT availability_schedules_appointment_type_id_fkey FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id) ON DELETE CASCADE;
ALTER TABLE public.availability_schedules ADD CONSTRAINT availability_schedules_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE;
ALTER TABLE public.availability_windows ADD CONSTRAINT availability_windows_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES availability_schedules(id) ON DELETE CASCADE;
ALTER TABLE public.booking_attendees ADD CONSTRAINT booking_attendees_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
ALTER TABLE public.booking_changes ADD CONSTRAINT booking_changes_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
ALTER TABLE public.booking_sessions ADD CONSTRAINT booking_sessions_appointment_type_id_fkey FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id) ON DELETE SET NULL;
ALTER TABLE public.booking_sessions ADD CONSTRAINT booking_sessions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.booking_sessions ADD CONSTRAINT booking_sessions_qualification_result_id_fkey FOREIGN KEY (qualification_result_id) REFERENCES qualification_results(id) ON DELETE SET NULL;
ALTER TABLE public.booking_sessions ADD CONSTRAINT booking_sessions_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_appointment_type_id_fkey FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_session_id_fkey FOREIGN KEY (session_id) REFERENCES booking_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL;
ALTER TABLE public.brief_sections ADD CONSTRAINT brief_sections_brief_id_fkey FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE CASCADE;
ALTER TABLE public.brief_sources ADD CONSTRAINT brief_sources_brief_id_fkey FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE CASCADE;
ALTER TABLE public.brief_sources ADD CONSTRAINT brief_sources_source_id_fkey FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE;
ALTER TABLE public.briefs ADD CONSTRAINT briefs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.calendar_blocks ADD CONSTRAINT calendar_blocks_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE;
ALTER TABLE public.calendar_integrations ADD CONSTRAINT calendar_integrations_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE;
ALTER TABLE public.client_roadmaps ADD CONSTRAINT client_roadmaps_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_roadmaps ADD CONSTRAINT client_roadmaps_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES client_subscriptions(id) ON DELETE SET NULL;
ALTER TABLE public.client_subscriptions ADD CONSTRAINT client_subscriptions_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_subscriptions ADD CONSTRAINT client_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES managed_service_plans(id);
ALTER TABLE public.consent_records ADD CONSTRAINT consent_records_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.consent_records ADD CONSTRAINT consent_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES booking_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.dashboard_preferences ADD CONSTRAINT dashboard_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.entity_tags ADD CONSTRAINT entity_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;
ALTER TABLE public.ideas ADD CONSTRAINT ideas_brief_id_fkey FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE SET NULL;
ALTER TABLE public.ingestion_logs ADD CONSTRAINT ingestion_logs_brief_id_fkey FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE SET NULL;
ALTER TABLE public.ingestion_logs ADD CONSTRAINT ingestion_logs_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE SET NULL;
ALTER TABLE public.intelligence_items ADD CONSTRAINT intelligence_items_brief_id_fkey FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE SET NULL;
ALTER TABLE public.intelligence_items ADD CONSTRAINT intelligence_items_source_id_fkey FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL;
ALTER TABLE public.maintenance_logs ADD CONSTRAINT maintenance_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.maintenance_logs ADD CONSTRAINT maintenance_logs_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES client_subscriptions(id) ON DELETE SET NULL;
ALTER TABLE public.managed_service_plans ADD CONSTRAINT managed_service_plans_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.notes ADD CONSTRAINT notes_action_item_id_fkey FOREIGN KEY (action_item_id) REFERENCES action_items(id) ON DELETE CASCADE;
ALTER TABLE public.notes ADD CONSTRAINT notes_brief_id_fkey FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE CASCADE;
ALTER TABLE public.notes ADD CONSTRAINT notes_intelligence_item_id_fkey FOREIGN KEY (intelligence_item_id) REFERENCES intelligence_items(id) ON DELETE CASCADE;
ALTER TABLE public.notes ADD CONSTRAINT notes_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE;
ALTER TABLE public.notes ADD CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.notification_deliveries ADD CONSTRAINT notification_deliveries_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE public.notification_deliveries ADD CONSTRAINT notification_deliveries_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.notification_jobs ADD CONSTRAINT notification_jobs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
ALTER TABLE public.notification_jobs ADD CONSTRAINT notification_jobs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_brief_id_fkey FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES managed_service_plans(id) ON DELETE SET NULL;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES client_subscriptions(id) ON DELETE SET NULL;
ALTER TABLE public.qualification_questions ADD CONSTRAINT qualification_questions_form_id_fkey FOREIGN KEY (form_id) REFERENCES qualification_forms(id) ON DELETE CASCADE;
ALTER TABLE public.qualification_questions ADD CONSTRAINT qualification_questions_parent_question_id_fkey FOREIGN KEY (parent_question_id) REFERENCES qualification_questions(id) ON DELETE SET NULL;
ALTER TABLE public.qualification_responses ADD CONSTRAINT qualification_responses_form_id_fkey FOREIGN KEY (form_id) REFERENCES qualification_forms(id) ON DELETE SET NULL;
ALTER TABLE public.qualification_responses ADD CONSTRAINT qualification_responses_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.qualification_responses ADD CONSTRAINT qualification_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES qualification_questions(id) ON DELETE SET NULL;
ALTER TABLE public.qualification_results ADD CONSTRAINT qualification_results_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.qualification_results ADD CONSTRAINT qualification_results_rule_set_id_fkey FOREIGN KEY (rule_set_id) REFERENCES qualification_rule_sets(id) ON DELETE SET NULL;
ALTER TABLE public.qualification_rule_sets ADD CONSTRAINT qualification_rule_sets_form_id_fkey FOREIGN KEY (form_id) REFERENCES qualification_forms(id) ON DELETE CASCADE;
ALTER TABLE public.qualification_rule_versions ADD CONSTRAINT qualification_rule_versions_rule_set_id_fkey FOREIGN KEY (rule_set_id) REFERENCES qualification_rule_sets(id) ON DELETE CASCADE;
ALTER TABLE public.reminder_schedules ADD CONSTRAINT reminder_schedules_appointment_type_id_fkey FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id) ON DELETE CASCADE;
ALTER TABLE public.risks ADD CONSTRAINT risks_brief_id_fkey FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_appointment_events ADD CONSTRAINT rsg_appointment_events_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES rsg_appointments(id) ON DELETE CASCADE;
ALTER TABLE public.rsg_appointments ADD CONSTRAINT rsg_appointments_call_id_fkey FOREIGN KEY (call_id) REFERENCES rsg_calls(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_appointments ADD CONSTRAINT rsg_appointments_consultation_type_id_fkey FOREIGN KEY (consultation_type_id) REFERENCES rsg_consultation_types(id);
ALTER TABLE public.rsg_appointments ADD CONSTRAINT rsg_appointments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES rsg_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_appointments ADD CONSTRAINT rsg_appointments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES rsg_leads(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_appointments ADD CONSTRAINT rsg_appointments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES rsg_staff(id);
ALTER TABLE public.rsg_business_hours ADD CONSTRAINT rsg_business_hours_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES rsg_staff(id) ON DELETE CASCADE;
ALTER TABLE public.rsg_call_turns ADD CONSTRAINT rsg_call_turns_call_id_fkey FOREIGN KEY (call_id) REFERENCES rsg_calls(id) ON DELETE CASCADE;
ALTER TABLE public.rsg_callback_requests ADD CONSTRAINT rsg_callback_requests_assigned_staff_id_fkey FOREIGN KEY (assigned_staff_id) REFERENCES rsg_staff(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_callback_requests ADD CONSTRAINT rsg_callback_requests_call_id_fkey FOREIGN KEY (call_id) REFERENCES rsg_calls(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_callback_requests ADD CONSTRAINT rsg_callback_requests_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES rsg_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_calls ADD CONSTRAINT rsg_calls_appointment_fkey FOREIGN KEY (appointment_id) REFERENCES rsg_appointments(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_calls ADD CONSTRAINT rsg_calls_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES rsg_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_calls ADD CONSTRAINT rsg_calls_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES rsg_leads(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_consents ADD CONSTRAINT rsg_consents_call_id_fkey FOREIGN KEY (call_id) REFERENCES rsg_calls(id) ON DELETE CASCADE;
ALTER TABLE public.rsg_consultation_types ADD CONSTRAINT rsg_consultation_types_default_staff_id_fkey FOREIGN KEY (default_staff_id) REFERENCES rsg_staff(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_external_busy ADD CONSTRAINT rsg_external_busy_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES rsg_staff(id) ON DELETE CASCADE;
ALTER TABLE public.rsg_holidays ADD CONSTRAINT rsg_holidays_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES rsg_staff(id) ON DELETE CASCADE;
ALTER TABLE public.rsg_leads ADD CONSTRAINT rsg_leads_assigned_staff_id_fkey FOREIGN KEY (assigned_staff_id) REFERENCES rsg_staff(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_leads ADD CONSTRAINT rsg_leads_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES rsg_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_leads ADD CONSTRAINT rsg_leads_recommended_consultation_type_id_fkey FOREIGN KEY (recommended_consultation_type_id) REFERENCES rsg_consultation_types(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_leads ADD CONSTRAINT rsg_leads_source_call_fkey FOREIGN KEY (source_call_id) REFERENCES rsg_calls(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_messages ADD CONSTRAINT rsg_messages_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES rsg_appointments(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_messages ADD CONSTRAINT rsg_messages_call_id_fkey FOREIGN KEY (call_id) REFERENCES rsg_calls(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_messages ADD CONSTRAINT rsg_messages_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES rsg_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_notifications ADD CONSTRAINT rsg_notifications_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES rsg_staff(id) ON DELETE CASCADE;
ALTER TABLE public.rsg_pricing ADD CONSTRAINT rsg_pricing_service_id_fkey FOREIGN KEY (service_id) REFERENCES rsg_services(id) ON DELETE CASCADE;
ALTER TABLE public.rsg_schedule_blocks ADD CONSTRAINT rsg_schedule_blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES rsg_staff(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_schedule_blocks ADD CONSTRAINT rsg_schedule_blocks_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES rsg_staff(id) ON DELETE CASCADE;
ALTER TABLE public.rsg_settings ADD CONSTRAINT rsg_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES rsg_staff(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_staff ADD CONSTRAINT rsg_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_staff_consultation_types ADD CONSTRAINT rsg_staff_consultation_types_consultation_type_id_fkey FOREIGN KEY (consultation_type_id) REFERENCES rsg_consultation_types(id) ON DELETE CASCADE;
ALTER TABLE public.rsg_staff_consultation_types ADD CONSTRAINT rsg_staff_consultation_types_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES rsg_staff(id) ON DELETE CASCADE;
ALTER TABLE public.rsg_support_tickets ADD CONSTRAINT rsg_support_tickets_assigned_staff_id_fkey FOREIGN KEY (assigned_staff_id) REFERENCES rsg_staff(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_support_tickets ADD CONSTRAINT rsg_support_tickets_call_id_fkey FOREIGN KEY (call_id) REFERENCES rsg_calls(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_support_tickets ADD CONSTRAINT rsg_support_tickets_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES rsg_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.rsg_tool_invocations ADD CONSTRAINT rsg_tool_invocations_call_id_fkey FOREIGN KEY (call_id) REFERENCES rsg_calls(id) ON DELETE CASCADE;
ALTER TABLE public.rsg_waitlist ADD CONSTRAINT rsg_waitlist_consultation_type_id_fkey FOREIGN KEY (consultation_type_id) REFERENCES rsg_consultation_types(id) ON DELETE CASCADE;
ALTER TABLE public.rsg_waitlist ADD CONSTRAINT rsg_waitlist_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES rsg_contacts(id) ON DELETE CASCADE;
ALTER TABLE public.scheduling_activity_logs ADD CONSTRAINT scheduling_activity_logs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE public.scheduling_activity_logs ADD CONSTRAINT scheduling_activity_logs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.service_reports ADD CONSTRAINT service_reports_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.service_reports ADD CONSTRAINT service_reports_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES client_subscriptions(id) ON DELETE SET NULL;
ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES client_subscriptions(id) ON DELETE SET NULL;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.subscription_events ADD CONSTRAINT subscription_events_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.subscription_events ADD CONSTRAINT subscription_events_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES client_subscriptions(id) ON DELETE CASCADE;
ALTER TABLE public.subscription_invoices ADD CONSTRAINT subscription_invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.subscription_invoices ADD CONSTRAINT subscription_invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES client_subscriptions(id) ON DELETE CASCADE;
ALTER TABLE public.webhook_deliveries ADD CONSTRAINT webhook_deliveries_endpoint_id_fkey FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints(id) ON DELETE CASCADE;


-- ============ INDEXES, FUNCTIONS ============

CREATE INDEX action_items_brief_id_idx ON public.action_items USING btree (brief_id);
CREATE INDEX action_items_due_date_idx ON public.action_items USING btree (due_date) WHERE (status <> ALL (ARRAY['completed'::text, 'dismissed'::text]));
CREATE INDEX action_items_owner_id_idx ON public.action_items USING btree (owner_id);
CREATE INDEX action_items_status_priority_idx ON public.action_items USING btree (status, priority);
CREATE UNIQUE INDEX appointment_types_slug_uidx ON public.appointment_types USING btree (slug) WHERE (deleted_at IS NULL);
CREATE INDEX audit_analytics_type_idx ON public.audit_analytics_events USING btree (event_type, created_at);
CREATE INDEX audit_answers_session_idx ON public.audit_answers USING btree (session_id);
CREATE INDEX audit_log_created_at_idx ON public.audit_log USING btree (created_at DESC);
CREATE INDEX audit_reports_token_idx ON public.audit_reports USING btree (access_token);
CREATE INDEX availability_windows_schedule_idx ON public.availability_windows USING btree (schedule_id);
CREATE INDEX booking_changes_booking_idx ON public.booking_changes USING btree (booking_id);
CREATE INDEX booking_sessions_expires_idx ON public.booking_sessions USING btree (expires_at);
CREATE INDEX booking_sessions_outcome_idx ON public.booking_sessions USING btree (qualification_outcome);
CREATE UNIQUE INDEX booking_sessions_token_uidx ON public.booking_sessions USING btree (token);
CREATE UNIQUE INDEX bookings_idempotency_uidx ON public.bookings USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX bookings_lead_idx ON public.bookings USING btree (lead_id);
CREATE UNIQUE INDEX bookings_manage_token_uidx ON public.bookings USING btree (manage_token);
CREATE INDEX bookings_member_idx ON public.bookings USING btree (team_member_id);
CREATE INDEX bookings_starts_at_idx ON public.bookings USING btree (starts_at);
CREATE INDEX bookings_status_idx ON public.bookings USING btree (status);
CREATE INDEX bookings_type_idx ON public.bookings USING btree (appointment_type_id);
CREATE INDEX brief_sections_brief_id_idx ON public.brief_sections USING btree (brief_id, "position");
CREATE INDEX brief_sources_source_id_idx ON public.brief_sources USING btree (source_id);
CREATE INDEX briefs_brief_date_idx ON public.briefs USING btree (brief_date DESC);
CREATE INDEX briefs_created_by_idx ON public.briefs USING btree (created_by);
CREATE INDEX briefs_priority_idx ON public.briefs USING btree (priority);
CREATE INDEX briefs_status_idx ON public.briefs USING btree (status, is_archived);
CREATE INDEX calendar_blocks_member_idx ON public.calendar_blocks USING btree (team_member_id);
CREATE INDEX calendar_blocks_range_idx ON public.calendar_blocks USING btree (starts_at, ends_at);
CREATE INDEX client_roadmaps_client_idx ON public.client_roadmaps USING btree (client_id, created_at DESC);
CREATE INDEX client_subscriptions_client_idx ON public.client_subscriptions USING btree (client_id, created_at DESC);
CREATE INDEX client_subscriptions_status_idx ON public.client_subscriptions USING btree (status);
CREATE UNIQUE INDEX client_subscriptions_stripe_sub_idx ON public.client_subscriptions USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL);
CREATE UNIQUE INDEX clients_email_lower_idx ON public.clients USING btree (lower(email));
CREATE INDEX entity_tags_entity_idx ON public.entity_tags USING btree (entity_type, entity_id);
CREATE INDEX ideas_brief_id_idx ON public.ideas USING btree (brief_id);
CREATE INDEX ingestion_logs_brief_id_idx ON public.ingestion_logs USING btree (brief_id);
CREATE INDEX ingestion_logs_integration_id_idx ON public.ingestion_logs USING btree (integration_id);
CREATE INDEX ingestion_logs_received_at_idx ON public.ingestion_logs USING btree (received_at DESC);
CREATE INDEX intelligence_brief_id_idx ON public.intelligence_items USING btree (brief_id);
CREATE INDEX intelligence_category_date_idx ON public.intelligence_items USING btree (category, date_observed DESC);
CREATE INDEX intelligence_source_id_idx ON public.intelligence_items USING btree (source_id);
CREATE INDEX leads_business_domain_idx ON public.leads USING btree (business_domain);
CREATE INDEX leads_created_at_idx ON public.leads USING btree (created_at DESC);
CREATE INDEX leads_is_test_idx ON public.leads USING btree (is_test);
CREATE INDEX leads_phone_normalized_idx ON public.leads USING btree (phone_normalized);
CREATE INDEX leads_qualification_outcome_idx ON public.leads USING btree (qualification_outcome);
CREATE INDEX leads_score_idx ON public.leads USING btree (lead_score DESC);
CREATE INDEX leads_session_token_idx ON public.leads USING btree (session_token);
CREATE INDEX maintenance_logs_client_idx ON public.maintenance_logs USING btree (client_id, performed_at DESC);
CREATE INDEX managed_service_plans_active_idx ON public.managed_service_plans USING btree (active, sort_order);
CREATE INDEX managed_service_plans_client_idx ON public.managed_service_plans USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX notes_action_item_id_idx ON public.notes USING btree (action_item_id);
CREATE INDEX notes_brief_id_idx ON public.notes USING btree (brief_id);
CREATE INDEX notes_intelligence_item_id_idx ON public.notes USING btree (intelligence_item_id);
CREATE INDEX notes_opportunity_id_idx ON public.notes USING btree (opportunity_id);
CREATE INDEX notes_user_id_idx ON public.notes USING btree (user_id);
CREATE INDEX notification_deliveries_booking_idx ON public.notification_deliveries USING btree (booking_id);
CREATE INDEX notification_deliveries_status_idx ON public.notification_deliveries USING btree (status);
CREATE INDEX notification_jobs_due_idx ON public.notification_jobs USING btree (due_at) WHERE (status = 'pending'::text);
CREATE INDEX notification_jobs_status_idx ON public.notification_jobs USING btree (status);
CREATE UNIQUE INDEX notification_templates_key_uidx ON public.notification_templates USING btree (key);
CREATE INDEX notifications_user_unread_idx ON public.notifications USING btree (user_id, is_read, created_at DESC);
CREATE INDEX opportunities_brief_id_idx ON public.opportunities USING btree (brief_id);
CREATE INDEX opportunities_stage_score_idx ON public.opportunities USING btree (stage, total_score DESC);
CREATE INDEX profiles_role_idx ON public.profiles USING btree (role);
CREATE INDEX proposals_client_idx ON public.proposals USING btree (client_id, created_at DESC);
CREATE INDEX proposals_status_idx ON public.proposals USING btree (status, created_at DESC);
CREATE UNIQUE INDEX qualification_questions_form_key_uidx ON public.qualification_questions USING btree (form_id, key);
CREATE INDEX qualification_responses_lead_idx ON public.qualification_responses USING btree (lead_id);
CREATE INDEX qualification_responses_session_idx ON public.qualification_responses USING btree (session_id);
CREATE INDEX qualification_results_lead_idx ON public.qualification_results USING btree (lead_id);
CREATE INDEX qualification_results_outcome_idx ON public.qualification_results USING btree (outcome);
CREATE INDEX risks_brief_id_idx ON public.risks USING btree (brief_id);
CREATE INDEX risks_status_severity_idx ON public.risks USING btree (status, severity);
CREATE INDEX rsg_appointment_events_appt_idx ON public.rsg_appointment_events USING btree (appointment_id);
CREATE INDEX rsg_appointments_contact_idx ON public.rsg_appointments USING btree (contact_id);
CREATE INDEX rsg_appointments_staff_idx ON public.rsg_appointments USING btree (staff_id, starts_at);
CREATE INDEX rsg_appointments_starts_idx ON public.rsg_appointments USING btree (starts_at);
CREATE INDEX rsg_audit_log_created_idx ON public.rsg_audit_log USING btree (created_at DESC);
CREATE INDEX rsg_audit_log_entity_idx ON public.rsg_audit_log USING btree (entity_type, entity_id);
CREATE INDEX rsg_calls_contact_idx ON public.rsg_calls USING btree (contact_id);
CREATE INDEX rsg_calls_from_idx ON public.rsg_calls USING btree (from_number);
CREATE INDEX rsg_calls_started_idx ON public.rsg_calls USING btree (started_at DESC);
CREATE INDEX rsg_contacts_business_idx ON public.rsg_contacts USING btree (lower(business_name));
CREATE INDEX rsg_contacts_email_idx ON public.rsg_contacts USING btree (lower(email));
CREATE INDEX rsg_contacts_phone_idx ON public.rsg_contacts USING btree (phone_primary);
CREATE INDEX rsg_external_busy_staff_idx ON public.rsg_external_busy USING btree (staff_id, starts_at);
CREATE INDEX rsg_jobs_due_idx ON public.rsg_jobs USING btree (status, run_at);
CREATE UNIQUE INDEX rsg_jobs_idempotency_idx ON public.rsg_jobs USING btree (job_type, idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX rsg_leads_class_idx ON public.rsg_leads USING btree (classification);
CREATE INDEX rsg_leads_contact_idx ON public.rsg_leads USING btree (contact_id);
CREATE INDEX rsg_leads_score_idx ON public.rsg_leads USING btree (score DESC);
CREATE INDEX rsg_messages_contact_idx ON public.rsg_messages USING btree (contact_id);
CREATE INDEX rsg_messages_provider_id_idx ON public.rsg_messages USING btree (provider_message_id);
CREATE INDEX rsg_messages_status_idx ON public.rsg_messages USING btree (status);
CREATE INDEX rsg_notifications_staff_idx ON public.rsg_notifications USING btree (staff_id, read_at);
CREATE INDEX rsg_tool_invocations_call_idx ON public.rsg_tool_invocations USING btree (call_id);
CREATE INDEX scheduling_activity_booking_idx ON public.scheduling_activity_logs USING btree (booking_id);
CREATE INDEX scheduling_activity_created_idx ON public.scheduling_activity_logs USING btree (created_at DESC);
CREATE INDEX scheduling_activity_lead_idx ON public.scheduling_activity_logs USING btree (lead_id);
CREATE INDEX scheduling_analytics_created_idx ON public.scheduling_analytics_events USING btree (created_at DESC) WHERE (is_test = false);
CREATE INDEX scheduling_analytics_type_idx ON public.scheduling_analytics_events USING btree (event_type);
CREATE INDEX service_reports_client_idx ON public.service_reports USING btree (client_id, period_end DESC);
CREATE INDEX service_requests_client_idx ON public.service_requests USING btree (client_id, created_at DESC);
CREATE INDEX service_requests_status_idx ON public.service_requests USING btree (status, created_at DESC);
CREATE UNIQUE INDEX services_slug_uidx ON public.services USING btree (slug) WHERE (deleted_at IS NULL);
CREATE INDEX sessions_client_id_idx ON public.sessions USING btree (client_id);
CREATE INDEX sessions_expires_at_idx ON public.sessions USING btree (expires_at);
CREATE UNIQUE INDEX sources_url_unique_idx ON public.sources USING btree (url) WHERE (url IS NOT NULL);
CREATE UNIQUE INDEX subscription_events_stripe_event_idx ON public.subscription_events USING btree (stripe_event_id) WHERE (stripe_event_id IS NOT NULL);
CREATE INDEX subscription_events_subscription_idx ON public.subscription_events USING btree (subscription_id, created_at DESC);
CREATE INDEX subscription_invoices_client_idx ON public.subscription_invoices USING btree (client_id, issued_at DESC);
CREATE UNIQUE INDEX subscription_invoices_stripe_idx ON public.subscription_invoices USING btree (stripe_invoice_id) WHERE (stripe_invoice_id IS NOT NULL);
CREATE UNIQUE INDEX team_members_email_uidx ON public.team_members USING btree (lower(email)) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX webhook_deliveries_idempotency_uidx ON public.webhook_deliveries USING btree (idempotency_key);

CREATE OR REPLACE FUNCTION public.audit_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$;


CREATE OR REPLACE FUNCTION public.ingest_executive_brief(payload jsonb, idempotency_key text, payload_hash text, source_type text DEFAULT 'webhook'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare
  log_id uuid;
  new_brief_id uuid;
  existing_brief_id uuid;
  item jsonb;
  source_record_id uuid;
  tag_record_id uuid;
  brief_slug text;
begin
  insert into public.ingestion_logs (idempotency_key, status, payload_hash, raw_payload)
  values (idempotency_key, 'processing', payload_hash, payload)
  on conflict on constraint ingestion_logs_idempotency_key_key do nothing
  returning id into log_id;

  if log_id is null then
    select brief_id into existing_brief_id from public.ingestion_logs where ingestion_logs.idempotency_key = ingest_executive_brief.idempotency_key;
    return jsonb_build_object('duplicate', true, 'briefId', existing_brief_id);
  end if;

  brief_slug := trim(both '-' from regexp_replace(lower(coalesce(payload->>'title','brief')), '[^a-z0-9]+', '-', 'g'));

  insert into public.briefs (
    title, slug, brief_type, schedule_name, source_type, source_identifier,
    executive_summary, content_markdown, content_json, brief_date,
    generated_at, priority, status, raw_payload
  ) values (
    payload->>'title', brief_slug, coalesce(payload->>'briefType','daily_executive'),
    payload->>'scheduleName', source_type, payload->>'sourceIdentifier',
    payload->>'executiveSummary', coalesce(payload->>'contentMarkdown',''), payload,
    (payload->>'briefDate')::date, nullif(payload->>'generatedAt','')::timestamptz,
    coalesce(payload->>'priority','medium'), 'published', payload
  )
  returning id into new_brief_id;

  for item in select value from jsonb_array_elements(coalesce(payload->'sections','[]'::jsonb)) loop
    insert into public.brief_sections (brief_id, section_type, heading, content, position)
    values (new_brief_id, coalesce(item->>'type','other'), coalesce(item->>'heading','Section'), coalesce(item->>'content',''), coalesce((item->>'position')::integer,0));
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload->'actions','[]'::jsonb)) loop
    insert into public.action_items (brief_id, title, description, why_it_matters, status, priority, impact_score, effort_score, category, due_date, source_section, requires_review)
    values (new_brief_id, item->>'title', item->>'description', item->>'whyItMatters', 'new', coalesce(item->>'priority','medium'), nullif(item->>'impactScore','')::integer, nullif(item->>'effortScore','')::integer, item->>'category', nullif(item->>'dueDate','')::date, item->>'sourceSection', true);
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload->'opportunities','[]'::jsonb)) loop
    insert into public.opportunities (brief_id, name, description, business_rationale, opportunity_type, horizon, target_customer, target_industry, potential_value, revenue_potential_score, strategic_fit_score, urgency_score, difficulty_score, speed_to_revenue_score, confidence_score, recommended_next_step, requires_review)
    values (new_brief_id, item->>'name', item->>'description', item->>'businessRationale', coalesce(item->>'opportunityType','operational_improvement'), coalesce(item->>'horizon','near_term'), item->>'targetCustomer', item->>'targetIndustry', item->>'potentialValue', nullif(item->>'revenuePotentialScore','')::integer, nullif(item->>'strategicFitScore','')::integer, nullif(item->>'urgencyScore','')::integer, nullif(item->>'difficultyScore','')::integer, nullif(item->>'speedToRevenueScore','')::integer, nullif(item->>'confidenceScore','')::integer, item->>'recommendedNextStep', true);
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload->'risks','[]'::jsonb)) loop
    insert into public.risks (brief_id, title, description, severity, probability, potential_impact, mitigation, status, time_horizon)
    values (new_brief_id, item->>'title', item->>'description', coalesce(item->>'severity','medium'), nullif(item->>'probability','')::integer, item->>'potentialImpact', item->>'mitigation', coalesce(item->>'status','monitoring'), item->>'timeHorizon');
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload->'intelligence','[]'::jsonb)) loop
    insert into public.intelligence_items (brief_id, headline, summary, why_it_matters, business_impact, category, urgency, confidence, geographic_relevance, event_date, publication_date)
    values (new_brief_id, item->>'headline', item->>'summary', item->>'whyItMatters', item->>'businessImpact', coalesce(item->>'category','other'), coalesce(item->>'urgency','medium'), nullif(item->>'confidence','')::integer, item->>'geographicRelevance', nullif(item->>'eventDate','')::date, nullif(item->>'publicationDate','')::date);
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload->'sources','[]'::jsonb)) loop
    source_record_id := null;
    if nullif(item->>'url','') is not null then
      select id into source_record_id from public.sources where url = item->>'url';
    end if;
    if source_record_id is null then
      insert into public.sources (title, publisher, author, url, source_type, credibility_level, publication_date)
      values (coalesce(item->>'title',item->>'url','Untitled source'), item->>'publisher', item->>'author', nullif(item->>'url',''), coalesce(item->>'sourceType','other'), coalesce(item->>'credibilityLevel','unclassified'), nullif(item->>'publicationDate','')::date)
      returning id into source_record_id;
    end if;
    insert into public.brief_sources (brief_id, source_id) values (new_brief_id, source_record_id) on conflict do nothing;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload->'tags','[]'::jsonb)) loop
    insert into public.tags (name, slug)
    values (trim(both '"' from item::text), trim(both '-' from regexp_replace(lower(trim(both '"' from item::text)), '[^a-z0-9]+', '-', 'g')))
    on conflict (slug) do update set name = excluded.name
    returning id into tag_record_id;
    insert into public.entity_tags (tag_id, entity_type, entity_id) values (tag_record_id, 'brief', new_brief_id) on conflict do nothing;
  end loop;

  insert into public.notifications (type, title, message, related_entity_type, related_entity_id)
  values ('new_brief', 'New brief received', payload->>'title', 'brief', new_brief_id);

  update public.ingestion_logs set status='succeeded', brief_id=new_brief_id, processed_at=now() where id=log_id;
  return jsonb_build_object('duplicate', false, 'briefId', new_brief_id, 'requestId', log_id);
exception when others then
  if log_id is not null then
    update public.ingestion_logs set status='failed', error_message=left(sqlerrm,500), processed_at=now() where id=log_id;
  end if;
  raise;
end;
$function$;


CREATE OR REPLACE FUNCTION public.is_dashboard_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$function$;


CREATE OR REPLACE FUNCTION public.rsg_audit_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor_id text := coalesce(auth.uid()::text, 'service');
  v_actor_type text := case when auth.uid() is not null then 'staff' else 'system' end;
  v_entity_id text;
begin
  v_entity_id := case when tg_op = 'DELETE'
    then (to_jsonb(old) ->> 'id')
    else (to_jsonb(new) ->> 'id')
  end;

  insert into rsg_audit_log (actor_type, actor_id, action, entity_type, entity_id, before, after)
  values (
    v_actor_type,
    v_actor_id,
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $function$;


CREATE OR REPLACE FUNCTION public.rsg_book_appointment(p_consultation_type_id uuid, p_staff_id uuid, p_contact_id uuid, p_lead_id uuid, p_call_id uuid, p_starts_at timestamp with time zone, p_timezone text DEFAULT 'America/New_York'::text, p_notes text DEFAULT NULL::text, p_booked_via text DEFAULT 'phone_ai'::text, p_is_demo boolean DEFAULT false)
 RETURNS rsg_appointments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_type rsg_consultation_types%rowtype;
  v_staff rsg_staff%rowtype;
  v_ends timestamptz;
  v_code text;
  v_appt rsg_appointments%rowtype;
  i int;
begin
  if auth.role() = 'authenticated' and not rsg_is_staff() then
    raise exception 'RSG_FORBIDDEN';
  end if;

  select * into v_type from rsg_consultation_types where id = p_consultation_type_id and active;
  if not found then
    raise exception 'RSG_UNKNOWN_CONSULTATION_TYPE';
  end if;

  select * into v_staff from rsg_staff where id = p_staff_id and is_active;
  if not found then
    raise exception 'RSG_UNKNOWN_STAFF';
  end if;

  if p_starts_at <= now() then
    raise exception 'RSG_PAST_TIME';
  end if;

  v_ends := p_starts_at + make_interval(mins => v_type.duration_minutes);

  if not rsg_slot_is_free(
    p_staff_id, p_starts_at, v_ends,
    v_type.buffer_before_minutes, v_type.buffer_after_minutes,
    null, p_timezone
  ) then
    raise exception 'RSG_SLOT_TAKEN';
  end if;

  for i in 1..5 loop
    v_code := rsg_generate_code('RSG');
    begin
      insert into rsg_appointments (
        confirmation_code, consultation_type_id, staff_id, contact_id, lead_id,
        call_id, starts_at, ends_at, timezone, status, notes, booked_via, is_demo
      ) values (
        v_code, p_consultation_type_id, p_staff_id, p_contact_id, p_lead_id,
        p_call_id, p_starts_at, v_ends, p_timezone, 'scheduled', p_notes, p_booked_via, p_is_demo
      ) returning * into v_appt;
      exit;
    exception
      when unique_violation then
        if i = 5 then raise; end if;
      when exclusion_violation then
        raise exception 'RSG_SLOT_TAKEN';
    end;
  end loop;

  insert into rsg_appointment_events (appointment_id, event_type, data, actor)
  values (v_appt.id, 'created', jsonb_build_object(
    'starts_at', v_appt.starts_at, 'ends_at', v_appt.ends_at,
    'booked_via', p_booked_via
  ), coalesce(auth.uid()::text, 'system'));

  if p_lead_id is not null then
    update rsg_leads set status = 'scheduled', updated_at = now()
    where id = p_lead_id and status in ('new','contacted','qualified');
  end if;

  return v_appt;
end $function$;


CREATE OR REPLACE FUNCTION public.rsg_cancel_appointment(p_appointment_id uuid, p_reason text DEFAULT NULL::text, p_actor text DEFAULT 'system'::text)
 RETURNS rsg_appointments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_appt rsg_appointments%rowtype;
begin
  if auth.role() = 'authenticated' and not rsg_is_staff() then
    raise exception 'RSG_FORBIDDEN';
  end if;

  select * into v_appt from rsg_appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'RSG_UNKNOWN_APPOINTMENT';
  end if;
  if v_appt.status in ('cancelled','completed') then
    raise exception 'RSG_NOT_CANCELLABLE';
  end if;

  update rsg_appointments set
    status = 'cancelled',
    cancellation_reason = p_reason,
    updated_at = now()
  where id = p_appointment_id
  returning * into v_appt;

  insert into rsg_appointment_events (appointment_id, event_type, data, actor)
  values (p_appointment_id, 'cancelled', jsonb_build_object('reason', p_reason), p_actor);

  return v_appt;
end $function$;


CREATE OR REPLACE FUNCTION public.rsg_claim_jobs(p_worker text, p_limit integer DEFAULT 10)
 RETURNS SETOF rsg_jobs
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with due as (
    select id from rsg_jobs
    where status = 'pending' and run_at <= now()
    order by run_at
    limit p_limit
    for update skip locked
  )
  update rsg_jobs j set
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker,
    attempts = j.attempts + 1,
    updated_at = now()
  from due
  where j.id = due.id
  returning j.*;
$function$;


CREATE OR REPLACE FUNCTION public.rsg_cleanup_rate_limits()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with deleted as (
    delete from rsg_rate_limits where window_start < now() - interval '2 days' returning 1
  )
  select count(*)::int from deleted;
$function$;


CREATE OR REPLACE FUNCTION public.rsg_generate_code(p_prefix text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, 1 + (get_byte(gen_random_bytes(1), 0) % length(chars)), 1);
  end loop;
  return p_prefix || '-' || result;
end $function$;


CREATE OR REPLACE FUNCTION public.rsg_is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from rsg_staff
    where user_id = auth.uid() and is_active
  );
$function$;


CREATE OR REPLACE FUNCTION public.rsg_rate_limit_hit(p_key text, p_window_seconds integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_window_start timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_full_key text := p_key || ':' || extract(epoch from v_window_start)::bigint::text;
  v_count int;
begin
  insert into rsg_rate_limits (rl_key, window_start, count)
  values (v_full_key, v_window_start, 1)
  on conflict (rl_key) do update set count = rsg_rate_limits.count + 1
  returning count into v_count;
  return v_count;
end $function$;


CREATE OR REPLACE FUNCTION public.rsg_reschedule_appointment(p_appointment_id uuid, p_new_starts_at timestamp with time zone, p_actor text DEFAULT 'system'::text)
 RETURNS rsg_appointments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_appt rsg_appointments%rowtype;
  v_type rsg_consultation_types%rowtype;
  v_new_ends timestamptz;
  v_old_starts timestamptz;
begin
  if auth.role() = 'authenticated' and not rsg_is_staff() then
    raise exception 'RSG_FORBIDDEN';
  end if;

  select * into v_appt from rsg_appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'RSG_UNKNOWN_APPOINTMENT';
  end if;
  if v_appt.status not in ('scheduled','confirmed') then
    raise exception 'RSG_NOT_RESCHEDULABLE';
  end if;

  select * into v_type from rsg_consultation_types where id = v_appt.consultation_type_id;
  if p_new_starts_at <= now() then
    raise exception 'RSG_PAST_TIME';
  end if;

  v_new_ends := p_new_starts_at + make_interval(mins => v_type.duration_minutes);

  if not rsg_slot_is_free(
    v_appt.staff_id, p_new_starts_at, v_new_ends,
    v_type.buffer_before_minutes, v_type.buffer_after_minutes,
    v_appt.id, v_appt.timezone
  ) then
    raise exception 'RSG_SLOT_TAKEN';
  end if;

  v_old_starts := v_appt.starts_at;

  begin
    update rsg_appointments set
      previous_starts_at = v_old_starts,
      starts_at = p_new_starts_at,
      ends_at = v_new_ends,
      reschedule_count = reschedule_count + 1,
      status = 'scheduled',
      updated_at = now()
    where id = p_appointment_id
    returning * into v_appt;
  exception
    when exclusion_violation then
      raise exception 'RSG_SLOT_TAKEN';
  end;

  insert into rsg_appointment_events (appointment_id, event_type, data, actor)
  values (p_appointment_id, 'rescheduled', jsonb_build_object(
    'from', v_old_starts, 'to', p_new_starts_at
  ), p_actor);

  return v_appt;
end $function$;


CREATE OR REPLACE FUNCTION public.rsg_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    (select role::text from rsg_staff where user_id = auth.uid() and is_active),
    'none'
  );
$function$;


CREATE OR REPLACE FUNCTION public.rsg_slot_is_free(p_staff_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_buffer_before_minutes integer DEFAULT 0, p_buffer_after_minutes integer DEFAULT 0, p_exclude_appointment_id uuid DEFAULT NULL::uuid, p_timezone text DEFAULT 'America/New_York'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_from timestamptz := p_starts_at - make_interval(mins => p_buffer_before_minutes);
  v_to   timestamptz := p_ends_at   + make_interval(mins => p_buffer_after_minutes);
  v_website_member uuid;
begin
  if exists (
    select 1
    from rsg_appointments a
    join rsg_consultation_types ct on ct.id = a.consultation_type_id
    where a.staff_id = p_staff_id
      and a.status in ('scheduled','confirmed')
      and (p_exclude_appointment_id is null or a.id <> p_exclude_appointment_id)
      and tstzrange(
            a.starts_at - make_interval(mins => ct.buffer_before_minutes),
            a.ends_at   + make_interval(mins => ct.buffer_after_minutes)
          ) && tstzrange(v_from, v_to)
  ) then
    return false;
  end if;

  if exists (
    select 1 from rsg_schedule_blocks b
    where b.staff_id = p_staff_id
      and tstzrange(b.starts_at, b.ends_at) && tstzrange(v_from, v_to)
  ) then
    return false;
  end if;

  if exists (
    select 1 from rsg_external_busy eb
    where eb.staff_id = p_staff_id
      and tstzrange(eb.starts_at, eb.ends_at) && tstzrange(v_from, v_to)
  ) then
    return false;
  end if;

  select website_team_member_id into v_website_member
  from rsg_staff where id = p_staff_id;

  if v_website_member is not null then
    if exists (
      select 1 from public.bookings wb
      where wb.team_member_id = v_website_member
        and wb.status not in ('cancelled','declined','no_show')
        and tstzrange(wb.starts_at, wb.ends_at) && tstzrange(v_from, v_to)
    ) then
      return false;
    end if;

    if exists (
      select 1 from public.calendar_blocks cb
      where (cb.team_member_id = v_website_member or cb.team_member_id is null)
        and tstzrange(cb.starts_at, cb.ends_at) && tstzrange(v_from, v_to)
    ) then
      return false;
    end if;
  end if;

  if exists (
    select 1 from rsg_holidays h
    where (h.staff_id is null or h.staff_id = p_staff_id)
      and h.holiday_date in (
        (p_starts_at at time zone p_timezone)::date,
        (p_ends_at   at time zone p_timezone)::date
      )
  ) then
    return false;
  end if;

  return true;
end $function$;


CREATE OR REPLACE FUNCTION public.rsg_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at := now();
  return new;
end $function$;


-- ============ TRIGGERS, VIEWS, RLS ENABLE, POLICIES ============

CREATE TRIGGER audit_email_touch BEFORE UPDATE ON public.audit_email_deliveries FOR EACH ROW EXECUTE FUNCTION audit_touch_updated_at();
CREATE TRIGGER audit_sessions_touch BEFORE UPDATE ON public.audit_sessions FOR EACH ROW EXECUTE FUNCTION audit_touch_updated_at();
CREATE TRIGGER rsg_appointments_audit AFTER INSERT OR DELETE OR UPDATE ON public.rsg_appointments FOR EACH ROW EXECUTE FUNCTION rsg_audit_trigger();
CREATE TRIGGER rsg_appointments_touch BEFORE UPDATE ON public.rsg_appointments FOR EACH ROW EXECUTE FUNCTION rsg_touch_updated_at();
CREATE TRIGGER rsg_callback_requests_touch BEFORE UPDATE ON public.rsg_callback_requests FOR EACH ROW EXECUTE FUNCTION rsg_touch_updated_at();
CREATE TRIGGER rsg_calls_touch BEFORE UPDATE ON public.rsg_calls FOR EACH ROW EXECUTE FUNCTION rsg_touch_updated_at();
CREATE TRIGGER rsg_consultation_types_audit AFTER INSERT OR DELETE OR UPDATE ON public.rsg_consultation_types FOR EACH ROW EXECUTE FUNCTION rsg_audit_trigger();
CREATE TRIGGER rsg_consultation_types_touch BEFORE UPDATE ON public.rsg_consultation_types FOR EACH ROW EXECUTE FUNCTION rsg_touch_updated_at();
CREATE TRIGGER rsg_contacts_audit AFTER INSERT OR DELETE OR UPDATE ON public.rsg_contacts FOR EACH ROW EXECUTE FUNCTION rsg_audit_trigger();
CREATE TRIGGER rsg_contacts_touch BEFORE UPDATE ON public.rsg_contacts FOR EACH ROW EXECUTE FUNCTION rsg_touch_updated_at();
CREATE TRIGGER rsg_integration_settings_audit AFTER INSERT OR DELETE OR UPDATE ON public.rsg_integration_settings FOR EACH ROW EXECUTE FUNCTION rsg_audit_trigger();
CREATE TRIGGER rsg_jobs_touch BEFORE UPDATE ON public.rsg_jobs FOR EACH ROW EXECUTE FUNCTION rsg_touch_updated_at();
CREATE TRIGGER rsg_lead_scoring_rules_audit AFTER INSERT OR DELETE OR UPDATE ON public.rsg_lead_scoring_rules FOR EACH ROW EXECUTE FUNCTION rsg_audit_trigger();
CREATE TRIGGER rsg_leads_audit AFTER INSERT OR DELETE OR UPDATE ON public.rsg_leads FOR EACH ROW EXECUTE FUNCTION rsg_audit_trigger();
CREATE TRIGGER rsg_leads_touch BEFORE UPDATE ON public.rsg_leads FOR EACH ROW EXECUTE FUNCTION rsg_touch_updated_at();
CREATE TRIGGER rsg_message_templates_audit AFTER INSERT OR DELETE OR UPDATE ON public.rsg_message_templates FOR EACH ROW EXECUTE FUNCTION rsg_audit_trigger();
CREATE TRIGGER rsg_messages_touch BEFORE UPDATE ON public.rsg_messages FOR EACH ROW EXECUTE FUNCTION rsg_touch_updated_at();
CREATE TRIGGER rsg_pricing_audit AFTER INSERT OR DELETE OR UPDATE ON public.rsg_pricing FOR EACH ROW EXECUTE FUNCTION rsg_audit_trigger();
CREATE TRIGGER rsg_services_touch BEFORE UPDATE ON public.rsg_services FOR EACH ROW EXECUTE FUNCTION rsg_touch_updated_at();
CREATE TRIGGER rsg_settings_audit AFTER INSERT OR DELETE OR UPDATE ON public.rsg_settings FOR EACH ROW EXECUTE FUNCTION rsg_audit_trigger();
CREATE TRIGGER rsg_staff_audit AFTER INSERT OR DELETE OR UPDATE ON public.rsg_staff FOR EACH ROW EXECUTE FUNCTION rsg_audit_trigger();
CREATE TRIGGER rsg_staff_touch BEFORE UPDATE ON public.rsg_staff FOR EACH ROW EXECUTE FUNCTION rsg_touch_updated_at();
CREATE TRIGGER rsg_support_tickets_touch BEFORE UPDATE ON public.rsg_support_tickets FOR EACH ROW EXECUTE FUNCTION rsg_touch_updated_at();

CREATE OR REPLACE VIEW public.rsg_v_call_stats_daily WITH (security_invoker = true) AS
 SELECT ((started_at AT TIME ZONE 'America/New_York'::text))::date AS day,
    count(*) AS total_calls,
    count(*) FILTER (WHERE (status = 'completed'::rsg_call_status)) AS completed_calls,
    count(*) FILTER (WHERE (status = ANY (ARRAY['failed'::rsg_call_status, 'abandoned'::rsg_call_status]))) AS dropped_calls,
    count(*) FILTER (WHERE (outcome = 'booked'::rsg_call_outcome)) AS booked,
    count(*) FILTER (WHERE (escalation <> 'none'::rsg_escalation)) AS escalated,
    count(*) FILTER (WHERE needs_review) AS needs_review,
    (COALESCE(avg(duration_seconds) FILTER (WHERE (duration_seconds IS NOT NULL)), (0)::numeric))::integer AS avg_duration_seconds
   FROM rsg_calls
  WHERE (channel = 'phone'::rsg_call_channel)
  GROUP BY (((started_at AT TIME ZONE 'America/New_York'::text))::date);

CREATE OR REPLACE VIEW public.rsg_v_upcoming_appointments WITH (security_invoker = true) AS
 SELECT a.id,
    a.confirmation_code,
    a.starts_at,
    a.ends_at,
    a.timezone,
    a.status,
    a.notes,
    a.booked_via,
    a.is_demo,
    ct.name AS consultation_name,
    ct.slug AS consultation_slug,
    ct.duration_minutes,
    s.full_name AS staff_name,
    s.id AS staff_id,
    c.full_name AS contact_name,
    c.business_name,
    c.phone_primary,
    c.email,
    c.id AS contact_id
   FROM (((rsg_appointments a
     JOIN rsg_consultation_types ct ON ((ct.id = a.consultation_type_id)))
     JOIN rsg_staff s ON ((s.id = a.staff_id)))
     LEFT JOIN rsg_contacts c ON ((c.id = a.contact_id)))
  WHERE ((a.status = ANY (ARRAY['scheduled'::rsg_appointment_status, 'confirmed'::rsg_appointment_status])) AND (a.starts_at >= now()))
  ORDER BY a.starts_at;

ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_booking_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_scoring_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_website_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brief_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brief_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intelligence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managed_service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualification_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualification_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualification_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualification_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualification_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_appointment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_call_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_callback_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_consultation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_external_busy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_lead_scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_qualification_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_staff_consultation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_tool_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsg_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dashboard admins delete action_items" ON public.action_items AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert action_items" ON public.action_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select action_items" ON public.action_items AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update action_items" ON public.action_items AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins delete ai_generations" ON public.ai_generations AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert ai_generations" ON public.ai_generations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select ai_generations" ON public.ai_generations AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update ai_generations" ON public.ai_generations AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "admins read own profile" ON public.audit_admin_users AS PERMISSIVE FOR SELECT TO authenticated USING ((id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Dashboard admins delete audit_log" ON public.audit_log AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert audit_log" ON public.audit_log AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select audit_log" ON public.audit_log AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update audit_log" ON public.audit_log AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins delete brief_sections" ON public.brief_sections AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert brief_sections" ON public.brief_sections AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select brief_sections" ON public.brief_sections AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update brief_sections" ON public.brief_sections AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins delete brief_sources" ON public.brief_sources AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert brief_sources" ON public.brief_sources AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select brief_sources" ON public.brief_sources AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update brief_sources" ON public.brief_sources AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins delete briefs" ON public.briefs AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert briefs" ON public.briefs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select briefs" ON public.briefs AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update briefs" ON public.briefs AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins delete dashboard_preferences" ON public.dashboard_preferences AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert dashboard_preferences" ON public.dashboard_preferences AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select dashboard_preferences" ON public.dashboard_preferences AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update dashboard_preferences" ON public.dashboard_preferences AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins delete entity_tags" ON public.entity_tags AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert entity_tags" ON public.entity_tags AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select entity_tags" ON public.entity_tags AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update entity_tags" ON public.entity_tags AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins delete ideas" ON public.ideas AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert ideas" ON public.ideas AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select ideas" ON public.ideas AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update ideas" ON public.ideas AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins delete ingestion_logs" ON public.ingestion_logs AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert ingestion_logs" ON public.ingestion_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select ingestion_logs" ON public.ingestion_logs AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update ingestion_logs" ON public.ingestion_logs AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins delete integrations" ON public.integrations AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert integrations" ON public.integrations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select integrations" ON public.integrations AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update integrations" ON public.integrations AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins delete intelligence_items" ON public.intelligence_items AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert intelligence_items" ON public.intelligence_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select intelligence_items" ON public.intelligence_items AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update intelligence_items" ON public.intelligence_items AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins delete notes" ON public.notes AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert notes" ON public.notes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select notes" ON public.notes AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update notes" ON public.notes AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins delete notifications" ON public.notifications AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert notifications" ON public.notifications AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update notifications" ON public.notifications AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins delete opportunities" ON public.opportunities AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert opportunities" ON public.opportunities AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select opportunities" ON public.opportunities AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update opportunities" ON public.opportunities AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Users read own profile or admins read all" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = id) OR ( SELECT is_dashboard_admin() AS is_dashboard_admin)));
CREATE POLICY "Users update own display name" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));
CREATE POLICY "Dashboard admins delete risks" ON public.risks AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert risks" ON public.risks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select risks" ON public.risks AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update risks" ON public.risks AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY rsg_appointment_events_staff_read ON public.rsg_appointment_events AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_appointments_admin_delete ON public.rsg_appointments AS PERMISSIVE FOR DELETE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_appointments_staff_insert ON public.rsg_appointments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_appointments_staff_read ON public.rsg_appointments AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_appointments_staff_update ON public.rsg_appointments AS PERMISSIVE FOR UPDATE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_audit_log_admin_read ON public.rsg_audit_log AS PERMISSIVE FOR SELECT TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_business_hours_admin_write ON public.rsg_business_hours AS PERMISSIVE FOR ALL TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_business_hours_staff_read ON public.rsg_business_hours AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_call_turns_staff_read ON public.rsg_call_turns AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_callback_requests_admin_delete ON public.rsg_callback_requests AS PERMISSIVE FOR DELETE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_callback_requests_staff_insert ON public.rsg_callback_requests AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_callback_requests_staff_read ON public.rsg_callback_requests AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_callback_requests_staff_update ON public.rsg_callback_requests AS PERMISSIVE FOR UPDATE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_calls_staff_read ON public.rsg_calls AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_calls_staff_update ON public.rsg_calls AS PERMISSIVE FOR UPDATE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_consents_staff_read ON public.rsg_consents AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_consultation_types_admin_write ON public.rsg_consultation_types AS PERMISSIVE FOR ALL TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_consultation_types_staff_read ON public.rsg_consultation_types AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_contacts_admin_delete ON public.rsg_contacts AS PERMISSIVE FOR DELETE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_contacts_staff_insert ON public.rsg_contacts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_contacts_staff_read ON public.rsg_contacts AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_contacts_staff_update ON public.rsg_contacts AS PERMISSIVE FOR UPDATE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_external_busy_admin_write ON public.rsg_external_busy AS PERMISSIVE FOR ALL TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_external_busy_staff_read ON public.rsg_external_busy AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_holidays_admin_write ON public.rsg_holidays AS PERMISSIVE FOR ALL TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_holidays_staff_read ON public.rsg_holidays AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_integration_settings_admin_write ON public.rsg_integration_settings AS PERMISSIVE FOR ALL TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_integration_settings_staff_read ON public.rsg_integration_settings AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_jobs_admin_read ON public.rsg_jobs AS PERMISSIVE FOR SELECT TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_lead_scoring_rules_admin_write ON public.rsg_lead_scoring_rules AS PERMISSIVE FOR ALL TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_lead_scoring_rules_staff_read ON public.rsg_lead_scoring_rules AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_leads_admin_delete ON public.rsg_leads AS PERMISSIVE FOR DELETE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_leads_staff_insert ON public.rsg_leads AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_leads_staff_read ON public.rsg_leads AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_leads_staff_update ON public.rsg_leads AS PERMISSIVE FOR UPDATE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_message_templates_admin_write ON public.rsg_message_templates AS PERMISSIVE FOR ALL TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_message_templates_staff_read ON public.rsg_message_templates AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_messages_staff_read ON public.rsg_messages AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_notifications_staff_read ON public.rsg_notifications AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_notifications_staff_update ON public.rsg_notifications AS PERMISSIVE FOR UPDATE TO authenticated USING (rsg_is_staff()) WITH CHECK (rsg_is_staff());
CREATE POLICY rsg_pricing_admin_write ON public.rsg_pricing AS PERMISSIVE FOR ALL TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_pricing_staff_read ON public.rsg_pricing AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_qualification_questions_admin_write ON public.rsg_qualification_questions AS PERMISSIVE FOR ALL TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_qualification_questions_staff_read ON public.rsg_qualification_questions AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_rate_limits_admin_read ON public.rsg_rate_limits AS PERMISSIVE FOR SELECT TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_schedule_blocks_admin_delete ON public.rsg_schedule_blocks AS PERMISSIVE FOR DELETE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_schedule_blocks_staff_insert ON public.rsg_schedule_blocks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_schedule_blocks_staff_read ON public.rsg_schedule_blocks AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_schedule_blocks_staff_update ON public.rsg_schedule_blocks AS PERMISSIVE FOR UPDATE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_services_admin_write ON public.rsg_services AS PERMISSIVE FOR ALL TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_services_staff_read ON public.rsg_services AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_settings_admin_write ON public.rsg_settings AS PERMISSIVE FOR ALL TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_settings_staff_read ON public.rsg_settings AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_staff_admin_write ON public.rsg_staff AS PERMISSIVE FOR ALL TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_staff_staff_read ON public.rsg_staff AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_staff_consultation_types_admin_write ON public.rsg_staff_consultation_types AS PERMISSIVE FOR ALL TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_staff_consultation_types_staff_read ON public.rsg_staff_consultation_types AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_support_tickets_admin_delete ON public.rsg_support_tickets AS PERMISSIVE FOR DELETE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_support_tickets_staff_insert ON public.rsg_support_tickets AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_support_tickets_staff_read ON public.rsg_support_tickets AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_support_tickets_staff_update ON public.rsg_support_tickets AS PERMISSIVE FOR UPDATE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_tool_invocations_staff_read ON public.rsg_tool_invocations AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_waitlist_admin_delete ON public.rsg_waitlist AS PERMISSIVE FOR DELETE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY rsg_waitlist_staff_insert ON public.rsg_waitlist AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_waitlist_staff_read ON public.rsg_waitlist AS PERMISSIVE FOR SELECT TO authenticated USING (rsg_is_staff());
CREATE POLICY rsg_waitlist_staff_update ON public.rsg_waitlist AS PERMISSIVE FOR UPDATE TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text]))) WITH CHECK ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])));
CREATE POLICY rsg_webhook_events_admin_read ON public.rsg_webhook_events AS PERMISSIVE FOR SELECT TO authenticated USING ((rsg_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY "Dashboard admins delete sources" ON public.sources AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert sources" ON public.sources AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select sources" ON public.sources AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update sources" ON public.sources AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins delete tags" ON public.tags AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins insert tags" ON public.tags AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins select tags" ON public.tags AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin));
CREATE POLICY "Dashboard admins update tags" ON public.tags AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_dashboard_admin() AS is_dashboard_admin)) WITH CHECK (( SELECT is_dashboard_admin() AS is_dashboard_admin));

