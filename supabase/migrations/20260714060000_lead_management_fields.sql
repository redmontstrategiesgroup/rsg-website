-- Lead management fields for the admin console (status, notes, owner, archive).
-- Safe to re-run: all columns use IF NOT EXISTS.

alter table public.leads
  add column if not exists status text not null default 'new',
  add column if not exists notes text,
  add column if not exists owner text,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Constrain status to known workflow values when the column is new or unconstrained.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_status_check'
  ) then
    alter table public.leads
      add constraint leads_status_check
      check (status in ('new', 'contacted', 'qualified', 'meeting_scheduled', 'won', 'lost', 'spam', 'archived'));
  end if;
end $$;

create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_email_idx on public.leads (lower(email));
