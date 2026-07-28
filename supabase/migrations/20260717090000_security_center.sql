-- RSG Security Center: incidents, vendor registry, retention rules,
-- AI approval queue, security test log, and security settings.
-- All tables are service-role only (RLS enabled, anon/authenticated revoked),
-- matching the enterprise-hardening posture.

-- ---- Widen admin roles (manager / employee / contractor / security_reviewer)
do $$
begin
  if to_regclass('public.admins') is not null then
    alter table public.admins drop constraint if exists admins_role_check;
    alter table public.admins add constraint admins_role_check
      check (role in (
        'owner', 'administrator', 'manager', 'scheduler', 'consultant',
        'sales', 'employee', 'contractor', 'security_reviewer', 'viewer'
      ));
  end if;
end $$;

-- ---- Incident records ---------------------------------------------------
create table if not exists public.security_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'contained', 'monitoring', 'resolved', 'closed')),
  owner text,
  systems_affected jsonb not null default '[]'::jsonb,
  -- Timeline entries: { at, actor, kind, text }
  -- kind: detected | containment | credential_rotation | isolation |
  --       log_preservation | notification | restoration | note | resolution | follow_up
  timeline jsonb not null default '[]'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  follow_up_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists security_incidents_status_idx on public.security_incidents (status);
create index if not exists security_incidents_detected_at_idx on public.security_incidents (detected_at desc);

alter table public.security_incidents enable row level security;
revoke all on table public.security_incidents from anon, authenticated;

-- ---- Vendor / subprocessor registry --------------------------------------
create table if not exists public.security_vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service text not null default '',
  purpose text not null default '',
  data_categories jsonb not null default '[]'::jsonb,
  environment text not null default 'production',
  hosting_region text,
  contract_owner text,
  security_docs_url text,
  agreement_status text not null default 'not_documented'
    check (agreement_status in (
      'not_documented', 'requested', 'in_review', 'terms_accepted',
      'dpa_signed', 'expired', 'terminated'
    )),
  renewal_date date,
  subprocessors text,
  access_level text,
  last_review_date date,
  risk_level text not null default 'medium'
    check (risk_level in ('low', 'medium', 'high')),
  removal_procedure text,
  notes text,
  status text not null default 'active'
    check (status in ('active', 'under_review', 'offboarding', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists security_vendors_status_idx on public.security_vendors (status);

alter table public.security_vendors enable row level security;
revoke all on table public.security_vendors from anon, authenticated;

-- ---- Data-retention rules -------------------------------------------------
create table if not exists public.retention_rules (
  id uuid primary key default gen_random_uuid(),
  data_category text not null,
  label text not null default '',
  -- Human description of the schedule, e.g. "24 months after last activity".
  retention_period text not null default '',
  retention_days integer,
  action_at_expiry text not null default 'manual_review'
    check (action_at_expiry in ('manual_review', 'anonymize', 'archive', 'delete')),
  legal_hold boolean not null default false,
  notes text,
  status text not null default 'active'
    check (status in ('draft', 'active', 'suspended')),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists retention_rules_category_idx on public.retention_rules (data_category);

alter table public.retention_rules enable row level security;
revoke all on table public.retention_rules from anon, authenticated;

-- ---- AI approval queue ------------------------------------------------------
create table if not exists public.ai_approvals (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  title text not null,
  -- The AI-drafted content under review (email body, proposal, etc.).
  content text not null default '',
  reason text not null default '',
  data_sources jsonb not null default '[]'::jsonb,
  records_affected jsonb not null default '[]'::jsonb,
  risk_level text not null default 'high'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  status text not null default 'awaiting_approval'
    check (status in (
      'drafted', 'awaiting_approval', 'approved', 'rejected',
      'executed', 'failed', 'escalated', 'expired'
    )),
  requested_by text not null default 'system',
  requested_at timestamptz not null default now(),
  expires_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  executed_at timestamptz,
  execution_result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_approvals_status_idx on public.ai_approvals (status);
create index if not exists ai_approvals_requested_at_idx on public.ai_approvals (requested_at desc);

alter table public.ai_approvals enable row level security;
revoke all on table public.ai_approvals from anon, authenticated;

-- ---- Security / AI abuse test log ------------------------------------------
create table if not exists public.security_tests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  target text not null default '',
  expected text not null default '',
  actual text not null default '',
  result text not null default 'not_run'
    check (result in ('not_run', 'pass', 'fail', 'partial')),
  severity text
    check (severity is null or severity in ('info', 'low', 'medium', 'high', 'critical')),
  evidence text,
  remediation text,
  retest_status text not null default 'none'
    check (retest_status in ('none', 'required', 'scheduled', 'passed', 'failed')),
  last_run_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists security_tests_category_idx on public.security_tests (category);
create index if not exists security_tests_result_idx on public.security_tests (result);

alter table public.security_tests enable row level security;
revoke all on table public.security_tests from anon, authenticated;

-- ---- Security settings (single row: MFA enforcement, packages, policies) ----
create table if not exists public.security_settings (
  id text primary key default 'default',
  settings jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.security_settings enable row level security;
revoke all on table public.security_settings from anon, authenticated;
