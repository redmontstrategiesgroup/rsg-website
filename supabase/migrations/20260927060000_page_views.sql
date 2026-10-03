-- Consented first-party page views (components/AnalyticsTracker.tsx ->
-- app/api/analytics).
--
-- Until now page views only ever reached the local JSON file store, which
-- refuses writes in production: the endpoint answered {recorded:true} while
-- every production view was dropped, and the admin console's analytics tab
-- was permanently empty. Same fix the subscribers table got in
-- 20260811150000_subscribers.sql.
--
-- Rows hold only the anonymous rsg_vid cookie id, the path, and the
-- referrer's host; nothing is written without rsg_consent=all.
--
-- Idempotent: safe to re-run against a database that already has the table.

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  vid text not null,
  path text not null,
  referrer text not null default '',
  viewed_at timestamptz not null default now()
);

-- The admin summary reads a trailing 30-day window, newest first.
create index if not exists page_views_viewed_at_idx
  on public.page_views (viewed_at desc);

-- Deny-all by default. The app connects with the service-role key, which
-- bypasses RLS, so no permissive policy is needed (matches public.leads).
alter table public.page_views enable row level security;
