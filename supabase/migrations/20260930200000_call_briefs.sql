-- Call → Proposal: one row per "Draft proposal" run on a lead. Claude reads the
-- lead's linked Pocket recordings, extracts a call brief (pain points, tools,
-- budget, timeline, with evidence quotes), then drafts a lifecycle proposal.
--
-- status: extracting -> drafting -> ready | failed (failed_stage says which).
-- Service-role only (RLS on, no policies), like leads / pocket_recordings.
-- Idempotent: safe to re-run.

create table if not exists public.call_briefs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  recording_ids uuid[] not null default '{}',
  status text not null default 'extracting'
    check (status in ('extracting', 'drafting', 'ready', 'failed')),
  failed_stage text check (failed_stage in ('extract', 'draft')),
  error text not null default '',
  extraction jsonb,
  truncated boolean not null default false,
  template_key text,
  -- Short phrase for the SOW's "planned to run for ___".
  term_length text not null default '',
  proposal_id uuid references public.lifecycle_proposals (id) on delete set null,
  warnings jsonb not null default '[]'::jsonb,
  model text not null default '',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  prompt_version text not null,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint call_briefs_failed_shape check ((status = 'failed') = (failed_stage is not null))
);

create index if not exists call_briefs_lead_idx
  on public.call_briefs (lead_id, created_at desc);

-- One active run per lead: a second click gets a unique violation (-> 409).
create unique index if not exists call_briefs_one_active_run
  on public.call_briefs (lead_id)
  where status in ('extracting', 'drafting');

alter table public.call_briefs enable row level security;

alter table public.lifecycle_proposals
  add column if not exists call_brief_id uuid
    references public.call_briefs (id) on delete set null;
