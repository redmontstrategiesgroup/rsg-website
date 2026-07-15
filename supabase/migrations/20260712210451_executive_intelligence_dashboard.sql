-- Redmont Strategies Group executive intelligence dashboard.
-- Private by default: anonymous access is revoked, authenticated access is
-- restricted to Supabase Auth users whose app_metadata.role is "admin", and
-- the existing RSG server uses the service role after validating its own admin
-- session. Never expose the service-role key to browser code.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 240),
  slug text not null,
  brief_type text not null default 'daily_executive',
  schedule_name text,
  source_type text not null default 'manual',
  source_identifier text,
  executive_summary text,
  content_markdown text not null default '',
  content_json jsonb not null default '{}'::jsonb,
  brief_date date not null,
  generated_at timestamptz,
  received_at timestamptz not null default now(),
  priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
  status text not null default 'published' check (status in ('draft','published','archived')),
  is_read boolean not null default false,
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  raw_payload jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, brief_date)
);

create table if not exists public.brief_sections (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs(id) on delete cascade,
  section_type text not null default 'other',
  heading text not null,
  content text not null,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text,
  author text,
  url text,
  source_type text not null default 'other' check (source_type in ('company_website','government','research_report','news_publication','industry_publication','social_media','podcast','video','financial_filing','local_publication','other')),
  credibility_level text not null default 'unclassified' check (credibility_level in ('high','medium','low','unclassified')),
  publication_date date,
  accessed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists sources_url_unique_idx on public.sources(url) where url is not null;

create table if not exists public.brief_sources (
  brief_id uuid not null references public.briefs(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  primary key (brief_id, source_id)
);

create table if not exists public.intelligence_items (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid references public.briefs(id) on delete set null,
  headline text not null,
  summary text,
  why_it_matters text,
  business_impact text,
  category text not null default 'other',
  urgency text not null default 'medium' check (urgency in ('critical','high','medium','low')),
  confidence integer check (confidence between 0 and 100),
  geographic_relevance text,
  relevant_service text,
  target_industry text,
  date_observed date not null default current_date,
  event_date date,
  publication_date date,
  source_id uuid references public.sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid references public.briefs(id) on delete set null,
  title text not null,
  description text,
  why_it_matters text,
  status text not null default 'new' check (status in ('new','reviewing','planned','in_progress','blocked','completed','dismissed')),
  priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
  impact_score integer check (impact_score between 1 and 10),
  effort_score integer check (effort_score between 1 and 10),
  owner_id uuid references auth.users(id) on delete set null,
  owner_name text,
  category text,
  due_date date,
  deferred_until date,
  completed_at timestamptz,
  source_section text,
  requires_review boolean not null default true,
  approved_at timestamptz,
  dismissal_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid references public.briefs(id) on delete set null,
  name text not null,
  description text,
  business_rationale text,
  opportunity_type text not null default 'operational_improvement',
  stage text not null default 'discovered' check (stage in ('discovered','reviewing','validating','approved','building','launched','paused','rejected')),
  horizon text not null default 'near_term' check (horizon in ('immediate','near_term','long_term','experimental')),
  target_customer text,
  target_industry text,
  problem text,
  proposed_solution text,
  revenue_model text,
  potential_value text,
  required_resources text,
  time_to_launch text,
  revenue_potential_score integer check (revenue_potential_score between 1 and 10),
  strategic_fit_score integer check (strategic_fit_score between 1 and 10),
  urgency_score integer check (urgency_score between 1 and 10),
  difficulty_score integer check (difficulty_score between 1 and 10),
  speed_to_revenue_score integer check (speed_to_revenue_score between 1 and 10),
  confidence_score integer check (confidence_score between 0 and 100),
  total_score numeric(5,1) generated always as (
    round(((coalesce(revenue_potential_score,5) + coalesce(strategic_fit_score,5) + coalesce(urgency_score,5) + (11-coalesce(difficulty_score,5)) + coalesce(speed_to_revenue_score,5) + (coalesce(confidence_score,50)/10.0)) / 6.0) * 10, 1)
  ) stored,
  recommended_next_step text,
  validation_steps text,
  notes text,
  requires_review boolean not null default true,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.risks (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid references public.briefs(id) on delete set null,
  title text not null,
  description text,
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  probability integer check (probability between 0 and 100),
  potential_impact text,
  mitigation text,
  status text not null default 'monitoring' check (status in ('active','monitoring','mitigated','accepted','closed')),
  time_horizon text,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid references public.briefs(id) on delete set null,
  title text not null,
  description text,
  idea_type text not null default 'service',
  status text not null default 'captured' check (status in ('captured','reviewing','validated','building','shipped','dismissed')),
  rationale text,
  next_step text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  brief_id uuid references public.briefs(id) on delete cascade,
  intelligence_item_id uuid references public.intelligence_items(id) on delete cascade,
  action_item_id uuid references public.action_items(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(brief_id, intelligence_item_id, action_item_id, opportunity_id) <= 1)
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.entity_tags (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.tags(id) on delete cascade,
  entity_type text not null check (entity_type in ('brief','intelligence','action','opportunity','risk','idea','source')),
  entity_id uuid not null,
  unique (tag_id, entity_type, entity_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  related_entity_type text,
  related_entity_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  integration_type text not null check (integration_type in ('webhook','email','gmail','google_calendar','database','api','n8n','make','zapier','custom')),
  name text not null,
  status text not null default 'disconnected' check (status in ('connected','disconnected','disabled','error')),
  configuration_encrypted bytea,
  settings jsonb not null default '{}'::jsonb,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingestion_logs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references public.integrations(id) on delete set null,
  request_identifier uuid not null default gen_random_uuid(),
  idempotency_key text not null unique,
  status text not null check (status in ('processing','succeeded','duplicate','failed')),
  payload_hash text not null,
  brief_id uuid references public.briefs(id) on delete set null,
  raw_payload jsonb,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  generation_type text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  output jsonb not null,
  confidence integer check (confidence between 0 and 100),
  approval_status text not null default 'pending' check (approval_status in ('pending','accepted','edited','rejected','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.dashboard_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notification_preferences jsonb not null default '{}'::jsonb,
  ai_processing_preferences jsonb not null default '{"enabled":false,"requireTaskReview":true,"requireOpportunityReview":true}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_identifier text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Query, join, sort, and RLS indexes.
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists briefs_brief_date_idx on public.briefs(brief_date desc);
create index if not exists briefs_status_idx on public.briefs(status, is_archived);
create index if not exists briefs_priority_idx on public.briefs(priority);
create index if not exists brief_sections_brief_id_idx on public.brief_sections(brief_id, position);
create index if not exists brief_sources_source_id_idx on public.brief_sources(source_id);
create index if not exists intelligence_brief_id_idx on public.intelligence_items(brief_id);
create index if not exists intelligence_category_date_idx on public.intelligence_items(category, date_observed desc);
create index if not exists action_items_brief_id_idx on public.action_items(brief_id);
create index if not exists action_items_status_priority_idx on public.action_items(status, priority);
create index if not exists action_items_due_date_idx on public.action_items(due_date) where status not in ('completed','dismissed');
create index if not exists opportunities_brief_id_idx on public.opportunities(brief_id);
create index if not exists opportunities_stage_score_idx on public.opportunities(stage, total_score desc);
create index if not exists risks_brief_id_idx on public.risks(brief_id);
create index if not exists risks_status_severity_idx on public.risks(status, severity);
create index if not exists ideas_brief_id_idx on public.ideas(brief_id);
create index if not exists notes_user_id_idx on public.notes(user_id);
create index if not exists entity_tags_entity_idx on public.entity_tags(entity_type, entity_id);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, is_read, created_at desc);
create index if not exists ingestion_logs_received_at_idx on public.ingestion_logs(received_at desc);
create index if not exists audit_log_created_at_idx on public.audit_log(created_at desc);

-- Admin authorization uses app_metadata, which users cannot edit themselves.
create or replace function public.is_dashboard_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;
revoke execute on function public.is_dashboard_admin() from public, anon;
grant execute on function public.is_dashboard_admin() to authenticated, service_role;

-- Atomic normalized ingestion. Only the server-side service role can execute.
create or replace function public.ingest_executive_brief(
  payload jsonb,
  idempotency_key text,
  payload_hash text,
  source_type text default 'webhook'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;
revoke execute on function public.ingest_executive_brief(jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.ingest_executive_brief(jsonb,text,text,text) to service_role;

-- RLS is enabled on every dashboard table in the exposed public schema.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','briefs','brief_sections','sources','brief_sources','intelligence_items',
    'action_items','opportunities','risks','ideas','notes','tags','entity_tags',
    'notifications','integrations','ingestion_logs','ai_generations',
    'dashboard_preferences','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('revoke all on table public.%I from authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end $$;

-- Future Supabase Auth administrators may use the Data API. Every policy
-- checks immutable app_metadata, never user-editable user_metadata.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'briefs','brief_sections','sources','brief_sources','intelligence_items',
    'action_items','opportunities','risks','ideas','notes','tags','entity_tags',
    'notifications','integrations','ingestion_logs','ai_generations',
    'dashboard_preferences','audit_log'
  ] loop
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('create policy "Dashboard admins select %1$I" on public.%1$I for select to authenticated using ((select public.is_dashboard_admin()))', table_name);
    execute format('create policy "Dashboard admins insert %1$I" on public.%1$I for insert to authenticated with check ((select public.is_dashboard_admin()))', table_name);
    execute format('create policy "Dashboard admins update %1$I" on public.%1$I for update to authenticated using ((select public.is_dashboard_admin())) with check ((select public.is_dashboard_admin()))', table_name);
    execute format('create policy "Dashboard admins delete %1$I" on public.%1$I for delete to authenticated using ((select public.is_dashboard_admin()))', table_name);
  end loop;
end $$;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
revoke select on public.integrations from authenticated;
grant select (id, integration_type, name, status, settings, last_success_at, last_failure_at, failure_message, created_at, updated_at)
  on public.integrations to authenticated;
create policy "Users read own profile or admins read all" on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select public.is_dashboard_admin()));
create policy "Users update own display name" on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- No grants or policies are created for anon. Raw payloads, integration
-- configuration, and all dashboard records remain inaccessible publicly.
