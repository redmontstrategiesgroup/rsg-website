-- Claude lead analysis: one row per run (score adjustment + drafted first reply).
-- Service-role only (RLS on, no policies), like the other admin tables.
create table if not exists public.lead_ai_insights (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  model text not null,
  prompt_version text not null,
  status text not null check (status in ('ok', 'failed')),
  error text,
  ai_fit_score integer check (ai_fit_score between 0 and 100),
  adjustment integer check (adjustment between -20 and 20),
  rationale text,
  signals jsonb,
  red_flags text[] not null default '{}',
  draft_subject text,
  draft_body text,
  sent_at timestamptz,
  sent_by text,
  sent_subject text,
  sent_body text,
  input_tokens integer,
  output_tokens integer
);

create index if not exists lead_ai_insights_lead_idx
  on public.lead_ai_insights (lead_id, created_at desc);

alter table public.lead_ai_insights enable row level security;

alter table public.leads
  add column if not exists rule_score integer,
  add column if not exists ai_score integer check (ai_score between 0 and 100),
  add column if not exists ai_insight_id uuid
    references public.lead_ai_insights(id) on delete set null;

-- Existing leads: their current score IS the rule score.
update public.leads set rule_score = lead_score where rule_score is null;
