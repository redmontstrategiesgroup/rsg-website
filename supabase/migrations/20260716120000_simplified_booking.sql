-- ---------------------------------------------------------------------------
-- Simplified booking flow (July 2026)
--
-- The public funnel becomes three steps: help category → time → details.
-- Help categories are plain-language rows in the existing `services` table so
-- every FK (booking_sessions.service_id, bookings.service_id) and the admin
-- panel keep working unchanged. The old technical services are deactivated,
-- not deleted — historical leads and bookings keep their references.
-- ---------------------------------------------------------------------------

-- 1. Plain-language help categories -----------------------------------------

insert into public.services (id, name, slug, description, sort_order) values
  ('b1000000-0000-4000-8000-000000000001', 'Get more leads or customers', 'more-leads', 'Bring in more of the right customers.', 10),
  ('b1000000-0000-4000-8000-000000000002', 'Improve my website or online presence', 'website-presence', 'A website and online presence that wins you business.', 20),
  ('b1000000-0000-4000-8000-000000000003', 'Automate repetitive business tasks', 'automate-tasks', 'Hand routine work off to systems that do it for you.', 30),
  ('b1000000-0000-4000-8000-000000000004', 'Improve customer communication or follow-up', 'customer-communication', 'Never let an inquiry or follow-up slip through.', 40),
  ('b1000000-0000-4000-8000-000000000005', 'Organize and improve business operations', 'business-operations', 'Cleaner day-to-day operations with less chaos.', 50),
  ('b1000000-0000-4000-8000-000000000006', 'Explore how AI could help my business', 'explore-ai', 'Find out where AI can genuinely save you time or money.', 60),
  ('b1000000-0000-4000-8000-000000000007', 'I''m not sure yet', 'not-sure', 'No problem — we''ll figure out the best starting point together.', 70),
  ('b1000000-0000-4000-8000-000000000008', 'Something else', 'something-else', 'Tell us what you have in mind.', 80)
on conflict (id) do nothing;

-- Retire the old technical service list from the public funnel.
update public.services
set active = false
where id in (
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000003',
  'b0000000-0000-4000-8000-000000000004',
  'b0000000-0000-4000-8000-000000000005',
  'b0000000-0000-4000-8000-000000000006',
  'b0000000-0000-4000-8000-000000000007',
  'b0000000-0000-4000-8000-000000000008',
  'b0000000-0000-4000-8000-000000000009',
  'b0000000-0000-4000-8000-000000000010',
  'b0000000-0000-4000-8000-000000000011'
);

-- 2. One general public appointment type -------------------------------------
-- Rename the existing 30-minute type (keeps its slug, reminder schedules,
-- availability rules, and any historical bookings) and hide the other types
-- from the public funnel. Admin can still book them internally.

update public.appointment_types
set
  name = 'Free Business Growth & Automation Consultation',
  public_description = 'A free 30-minute conversation about your business. We''ll talk through what you want to improve, identify the strongest opportunities, and recommend practical next steps. No preparation or technical knowledge needed.',
  confirmation_message = 'Your consultation is booked. We''ll review the information you provided and come prepared with practical recommendations.',
  updated_at = now()
where id = 'c0000000-0000-4000-8000-000000000002';

update public.appointment_types
set is_public = false, updated_at = now()
where id in (
  'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000003',
  'c0000000-0000-4000-8000-000000000004'
);

-- 3. Lead fields for the simplified intake ------------------------------------

alter table public.leads
  add column if not exists preferred_contact text not null default '';

-- 4. Friendlier notification templates ---------------------------------------

update public.notification_templates
set
  subject = 'Your consultation is booked — {{appointment_time_local}}',
  body_html = '<p>Hi {{first_name}},</p>'
    || '<p>Your consultation with Redmont Strategies Group is confirmed.</p>'
    || '<p><strong>{{appointment_time_local}}</strong> ({{timezone}})<br/>'
    || 'Format: {{meeting_format}}<br/>'
    || 'Topic: {{service}}</p>'
    || '<p>On the call we''ll review what you shared, talk through your goals, identify the strongest opportunities, and recommend practical next steps. There''s nothing you need to prepare.</p>'
    || '<p>Need to make a change? <a href="{{manage_url}}">Reschedule or cancel here</a>.</p>'
    || '<p>— Redmont Strategies Group</p>',
  body_text = 'Hi {{first_name}}, your consultation is confirmed for {{appointment_time_local}} ({{timezone}}). Format: {{meeting_format}}. Reschedule or cancel: {{manage_url}}'
where key = 'visitor_booking_confirmation';

update public.notification_templates
set
  body_html = '<p>Booking confirmed.</p><ul>'
    || '<li>{{full_name}} / {{business_name}}</li>'
    || '<li>{{email}} / {{phone}}</li>'
    || '<li>Help with: {{service}}</li>'
    || '<li>{{appointment_type}} at {{appointment_time_admin}} (visitor: {{appointment_time_local}} {{timezone}})</li>'
    || '<li>Format: {{meeting_format}}</li>'
    || '<li>Preferred contact: {{preferred_contact}}</li>'
    || '<li>Wants help improving: {{improvement_note}}</li>'
    || '<li>Notes: {{visitor_notes}}</li>'
    || '<li>Source: {{lead_source}} · {{page_url}}</li>'
    || '</ul><p><a href="{{admin_lead_url}}">Lead</a> · <a href="{{admin_booking_url}}">Appointment</a></p>'
where key = 'internal_booking_created';
