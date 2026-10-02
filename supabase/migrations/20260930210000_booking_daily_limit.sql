-- Enforce the booking policy's race-prone rules in the database so two
-- simultaneous requests can't both pass the app-level slot check:
--   * max 2 active bookings per team member per local day
--   * at least 60 minutes between a team member's bookings
-- Keep the numbers in sync with lib/scheduling/policy.ts (maxPerDay,
-- minGapMinutes). Day/hour/notice rules aren't racy and stay in the app.

create or replace function public.enforce_booking_policy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  tz text;
  local_day date;
  day_count int;
begin
  if new.team_member_id is null
     or new.status not in ('confirmed', 'rescheduled') then
    return new;
  end if;

  -- Status-only edits on an already-active booking (notes, sequence, …)
  -- don't move it, so there's nothing new to check.
  if tg_op = 'UPDATE'
     and old.status in ('confirmed', 'rescheduled')
     and old.team_member_id is not distinct from new.team_member_id
     and old.starts_at = new.starts_at
     and old.ends_at = new.ends_at then
    return new;
  end if;

  -- Serialize writes per team member: the second of two concurrent requests
  -- waits here, then sees the first one's committed row below.
  perform pg_advisory_xact_lock(
    hashtextextended('bookings:' || new.team_member_id::text, 0)
  );

  select coalesce(nullif(tm.timezone, ''), 'America/New_York')
    into tz
    from team_members tm
   where tm.id = new.team_member_id;
  tz := coalesce(tz, 'America/New_York');
  local_day := (new.starts_at at time zone tz)::date;

  select count(*) into day_count
    from bookings b
   where b.team_member_id = new.team_member_id
     and b.id <> new.id
     and b.status in ('confirmed', 'rescheduled')
     and (b.starts_at at time zone tz)::date = local_day;

  if day_count >= 2 then
    raise exception 'bookings_daily_limit: that day is fully booked'
      using errcode = '23P01';
  end if;

  if exists (
    select 1
      from bookings b
     where b.team_member_id = new.team_member_id
       and b.id <> new.id
       and b.status in ('confirmed', 'rescheduled')
       and b.starts_at < new.ends_at + interval '60 minutes'
       and b.ends_at > new.starts_at - interval '60 minutes'
  ) then
    raise exception 'bookings_min_gap: bookings need an hour between them'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_enforce_policy on public.bookings;
create trigger bookings_enforce_policy
  before insert or update of starts_at, ends_at, status, team_member_id
  on public.bookings
  for each row
  execute function public.enforce_booking_policy();
