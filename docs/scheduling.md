# Native Scheduling Platform

## Overview

Redmont Strategies Group uses a built-in consultation booking system at `/book`.
Visitors complete a multi-step intake, are scored server-side, and only see the
calendar when they qualify.

## Setup

1. **Apply the database migration in Supabase** (required once):
   - Open the file on your Desktop: `RSG_PASTE_THIS_INTO_SUPABASE.sql`
     (or `supabase/migrations/20260714180000_scheduling_platform.sql` in this repo)
   - Select all (`Ctrl+A`) → Copy (`Ctrl+C`)
   - In [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor** → **New query**
   - Paste the SQL (`Ctrl+V`). The first line must be a comment starting with `-- Native Redmont...`
   - Click **Run**
   - Do **not** paste the file path. Paste the file contents only.

2. Ensure environment variables are set (see `.env.example`):

   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (**required** for booking)
   - `RESEND_API_KEY` / `CONTACT_TO_EMAIL` / `CONTACT_FROM_EMAIL`
   - `CRON_SECRET` for reminder processing
   - `SCHEDULING_TIMEZONE` (default `America/New_York`)
   - Optional Turnstile keys for bot protection on session start

3. Configure Vercel Cron (included in `vercel.json`) to hit
   `/api/cron/scheduling` every 5 minutes with `Authorization: Bearer $CRON_SECRET`.

4. Open **Admin → Scheduling** to manage availability, questions, rules,
   appointment types, templates, and test qualification.

## Public routes

| Route | Purpose |
|-------|---------|
| `/book` | Main intake + booking funnel |
| `/book/consultation` | Presets strategy appointment |
| `/book/strategy` | Strategy call preset |
| `/book/[slug]` | Appointment-type slug |
| `/booking/confirmed` | Confirmation |
| `/booking/review` | Manual review outcome |
| `/booking/not-eligible` | Not eligible outcome |
| `/booking/manage/[token]` | Secure reschedule / cancel |

## Security notes

- Qualification scoring and slot booking run only on the server.
- Public APIs never return point maps or thresholds.
- Double-booking is prevented with a Postgres exclusion constraint plus a
  pre-insert availability recheck.
- Manage links use long unguessable tokens (not sequential IDs).
- Cron and service-role keys stay server-side.

## Default internal email

`contact@redmontstrategiesgroup.com`

## Acceptance checklist

1. Complete qualification on `/book`
2. Confirm score is computed server-side
3. Qualified visitors see real slots
4. Direct calendar access without a qualified session is blocked
5. Concurrent booking of the same slot fails for the second request
6. Visitor receives confirmation (+ ICS)
7. Internal inbox receives notification
8. Lead appears in Admin → Leads
9. Booking appears in Admin → Scheduling
10. Qualification answers attached to the lead
11–13. Admin can edit questions, rules, availability, and types without code
14–15. Admin and visitor can reschedule/cancel
16–17. Reminders enqueue; failures show under Scheduling → Jobs
18. Activity timeline logs major actions
19. Mobile layouts work on `/book`
20. No placeholder/demo booking integrations claiming to be connected
