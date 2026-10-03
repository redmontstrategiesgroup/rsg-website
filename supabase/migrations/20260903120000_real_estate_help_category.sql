-- ---------------------------------------------------------------------------
-- Real estate vertical (September 2026)
--
-- The retail vertical was retired and the slot reused for residential
-- brokerages and agent teams. The retail help category CANNOT be deleted:
-- booking_sessions.service_id and bookings.service_id reference it, and
-- historical bookings must keep resolving. It is deactivated instead — the
-- same pattern the July 2026 simplified-booking migration used to retire the
-- old technical service list.
--
-- Deactivation uses `active = false`, not `deleted_at`. The unique index on
-- slug is `where deleted_at is null`, so soft-deleting would free the slug,
-- and the admin scheduling panel filters `deleted_at is null`, so the row
-- would vanish from it entirely. `active = false` keeps the row visible,
-- reversible, and out of the public funnel.
--
-- The replacement takes sort_order 15, the slot the retail row held, so the
-- funnel's list order is unchanged.
-- ---------------------------------------------------------------------------

update public.services
set active = false, updated_at = now()
where id = 'b1000000-0000-4000-8000-000000000009';

insert into public.services (id, name, slug, description, sort_order) values
  ('b1000000-0000-4000-8000-000000000010',
   'Get more listings and close more deals',
   'real-estate-listings-deals',
   'Lead response, showing coordination, transaction deadlines, and past-client referral systems for residential brokerages and agent teams.',
   15)
on conflict (id) do nothing;
