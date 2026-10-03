-- Tie a lead back to the consented browsing that produced it.
--
-- visitor_id  = the anonymous rsg_vid cookie at submit time, so the admin
--               console can show the page_views that led to the inquiry.
-- first_touch = the rsg_ft cookie: UTMs, referrer host and landing page from
--               the visitor's first consented visit (up to 90 days earlier),
--               so a lead that returns "direct" still credits the campaign.
--
-- Both stay null unless the visitor accepted cookies (rsg_consent=all).
--
-- Idempotent: safe to re-run.

alter table public.leads add column if not exists visitor_id text;
alter table public.leads add column if not exists first_touch jsonb;

-- The admin lead card looks up page views by visitor id.
create index if not exists page_views_vid_idx
  on public.page_views (vid, viewed_at);
