-- ---------------------------------------------------------------------------
-- Retail expansion (July 2026)
--
-- Adds a retail-focused plain-language help category to the simplified
-- booking funnel ("What would you most like to improve?"). Uses the existing
-- `services` table so every FK (booking_sessions.service_id,
-- bookings.service_id) and the admin panel keep working unchanged.
-- Sorted just after "Get more leads or customers" so retail owners see a
-- category that speaks to them without lengthening the list for everyone.
-- ---------------------------------------------------------------------------

insert into public.services (id, name, slug, description, sort_order) values
  ('b1000000-0000-4000-8000-000000000009',
   'Get more repeat customers for my store',
   'retail-repeat-customers',
   'Customer retention, loyalty, win-backs, and missed-sale recovery for retail and ecommerce.',
   15)
on conflict (id) do nothing;
