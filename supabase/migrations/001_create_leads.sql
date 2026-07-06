-- Contact form leads captured by the website (app/actions/contact.ts).
-- Run this against your Supabase project (SQL editor or `supabase db push`),
-- then set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the app environment.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_name text not null,
  website text,
  email text not null,
  phone text,
  industry text,
  biggest_problem text,
  improvement_goal text,
  -- Intake preferences
  preferred_contact text,
  best_time text,
  timeline text,
  -- Attribution
  page_url text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  -- Basic lead score (0-100), computed server-side at submission
  lead_score integer not null default 0,
  source text not null default 'website_contact_form',
  created_at timestamptz not null default now()
);

-- Lock the table down: no anon/authenticated access. The app writes with the
-- service-role key, which bypasses RLS — no public policies are needed.
alter table public.leads enable row level security;

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_score_idx on public.leads (lead_score desc);
