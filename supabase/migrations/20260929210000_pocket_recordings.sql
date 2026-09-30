-- Pocket: recordings from the Pocket clip-on AI recorder (heypocketai.com)
-- on the back of the phone, shown in the admin console's Pocket tab.
--
-- Two sources:
--   pocket  synced from the Pocket public API (sync button + webhook). Pocket
--           already transcribes and summarizes; audio stays in Pocket and is
--           played back through a short-lived Pocket-signed URL.
--   upload  an audio file uploaded by hand (private `rsg-files` bucket under
--           pocket/<id>/), transcribed with OpenAI Whisper and summarized by
--           Claude.
--
-- status: awaiting_upload -> processing -> ready | failed
--
-- Idempotent: safe to re-run.

create table if not exists public.pocket_recordings (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'upload'
    check (source in ('upload', 'pocket')),
  pocket_id text,
  pocket_updated_at timestamptz,
  title text not null default '',
  file_name text not null default '',
  storage_path text,
  mime_type text not null default '',
  size_bytes bigint not null default 0,
  duration_seconds numeric,
  recorded_at timestamptz,
  status text not null default 'awaiting_upload'
    check (status in ('awaiting_upload', 'processing', 'ready', 'failed')),
  error text not null default '',
  language text not null default '',
  transcript text not null default '',
  transcript_segments jsonb not null default '[]'::jsonb,
  summary text not null default '',
  key_points jsonb not null default '[]'::jsonb,
  action_items jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  notes text not null default '',
  lead_id uuid references public.leads (id) on delete set null,
  uploaded_by text not null default '',
  -- Set when an admin deletes a synced recording: the row stays as a
  -- tombstone (content cleared) so the next sync doesn't re-import it.
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One row per Pocket recording: the sync and the webhook both upsert on it.
  -- (NULLs are distinct, so uploads without a pocket_id never collide.)
  constraint pocket_recordings_pocket_id_key unique (pocket_id),
  -- An uploaded file always has an object in storage; a synced one never does.
  constraint pocket_recordings_source_shape check (
    (source = 'upload' and storage_path is not null)
    or (source = 'pocket' and pocket_id is not null)
  )
);

-- The console lists visible recordings newest first.
create index if not exists pocket_recordings_recorded_idx
  on public.pocket_recordings (recorded_at desc nulls last, created_at desc)
  where dismissed_at is null;

create index if not exists pocket_recordings_lead_id_idx
  on public.pocket_recordings (lead_id)
  where lead_id is not null;

-- Deny-all by default. The app connects with the service-role key, which
-- bypasses RLS, so no permissive policy is needed (matches public.leads).
alter table public.pocket_recordings enable row level security;
