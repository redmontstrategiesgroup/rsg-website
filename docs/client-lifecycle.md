# RSG Client Lifecycle Platform

One connected workflow from first interest to renewal: qualification → assessment →
booking → preparation → consultation → proposal → contract → deposit → portal →
onboarding → milestones → training → support → reporting → renewal/expansion.

This document is the implementation architecture and setup guide. It extends the
existing platform — it does not replace the booking engine, portal auth, admin
console, or email systems.

## What is reused (do not rebuild)

| Capability | Existing system |
|---|---|
| Qualification-scored booking | `/book` funnel, `booking_sessions`, `bookings`, `appointment_types`, `lib/scheduling/*` |
| Client login + sessions | `clients` + `sessions` tables, `lib/auth.ts` (scrypt, signed `rsg_session` cookie, revocable) |
| Admin auth + RBAC + MFA | `admins`, `admin_sessions`, `lib/admin-auth.ts`, `lib/scheduling/permissions.ts`, `lib/totp.ts` |
| Templated email | `notification_templates` + `lib/scheduling/notifications.ts` (`sendTemplatedEmail`) |
| Durable email retry | `email_jobs` + `lib/email-jobs.ts` |
| Cron processing | `/api/cron/scheduling` (Vercel cron, bearer `CRON_SECRET`) |
| CSRF / bot / origin defense | `middleware.ts` (double-submit `rsg_csrf` + `x-csrf-token` via `lib/api.ts`) |
| Rate limiting | `lib/security.ts` (Upstash w/ in-memory fallback) |
| Audit log | `audit_events` + `writeAuditEvent` |
| Lead pipeline | `leads` table, `lib/leads.ts` (`processLead`) |

## New: journey spine

`sales_opportunities` is the connective row that carries a prospect through the
funnel. Each stage records status, next action, responsible party, and deadline
(computed by `lib/lifecycle/journey.ts`):

```
lead (qualification form /start)
  └─ assessment (assessments + assessment_responses)
      └─ booking (existing bookings; appointment type recommended from answers)
          └─ questionnaire (questionnaires + responses → prep brief)
              └─ proposal (proposals + options + events + comments)
                  └─ contract (contracts + signatures + events)
                      └─ deposit invoice (invoices + payments; Stripe or manual)
                          └─ client + portal activation (clients, client_users)
                              └─ project (projects, milestones, tasks, approvals)
                                  └─ delivery (requests, messages, files, training, tickets)
                                      └─ reports (metrics, reports)
                                          └─ renewals + expansion_items
```

Information carries forward automatically: the lead's answers seed the
assessment; assessment answers pick the recommended appointment type and seed
the questionnaire; the questionnaire seeds the consultation prep brief and the
proposal's challenges section; the approved proposal seeds the contract and the
deposit invoice; payment activates the portal, creates the project from the
proposal phases, and generates onboarding tasks.

## Data model (migration `20260717090000_client_lifecycle.sql`)

All new tables: RLS enabled, no policies, `revoke all ... from anon, authenticated`
— service-role access only, matching the platform convention. Client separation
is enforced in the app layer: every portal query is scoped by the session's
`client_id` through `lib/lifecycle/access.ts` (single choke point).

New tables: `client_users`, `assessments`, `assessment_responses`,
`questionnaires`, `questionnaire_responses`, `sales_opportunities`,
`lifecycle_proposals` (named to avoid the managed-services `proposals` table),
`proposal_options`, `proposal_events`, `proposal_comments`, `contracts`,
`contract_signatures`, `contract_events`, `invoices`, `payments`, `projects`,
`project_members`, `milestones`, `project_tasks`, `requests`, `messages`,
`files`, `file_versions`, `approvals`, `training_items`, `training_assignments`,
`training_completions`, `tickets`, `sla_policies`, `reports`, `metrics`,
`renewals`, `expansion_items`, `lifecycle_notifications`, `automation_settings`,
`automation_runs`, `client_activity`.

Alters: `clients` gains status/contact/goals columns + `lead_id` +
`stripe_customer_id`; `leads` gains the qualification-form fields
(`service_area`, `revenue_range`, `budget_range`, `desired_outcome`,
`current_systems`, `heard_about`, `service_category`) and the status CHECK is
widened to match `LeadStatus` in `lib/types.ts` (fixes an existing mismatch).

Seeds: six appointment types (Business Systems / Growth Systems / Operations
Systems / Private AI consultations, Existing Client Strategy Call, Technical
Support Session), lifecycle `notification_templates`, default `sla_policies`,
default `automation_settings`, and a private `rsg-files` storage bucket.

Money is stored in integer cents. Status fields are text + CHECK constraints.
Presentation content (proposal/contract sections, report narratives) is JSONB;
workflow-critical facts (statuses, amounts, dates, signers, approvals) are
proper columns per the "no critical data in unstructured JSON" rule.

## Domain layer — `lib/lifecycle/`

| Module | Responsibility |
|---|---|
| `types.ts` | All entity types, status unions, labels, stage definitions |
| `db.ts` | Supabase CRUD per entity (service-role), snake↔camel mapping |
| `access.ts` | `requirePortalContext()` — session → client + client_user + role; portal permission checks; admin permission map |
| `journey.ts` | Stage computation: status / next action / responsible party / deadline per opportunity + client |
| `assessment-content.ts` | Assessment sections, conditional visibility, scoring, summary generation |
| `questionnaire-content.ts` | Prep questionnaire templates per service category; prep-brief builder |
| `proposal-templates.ts` | Reusable proposal section/phase templates per service category |
| `contract-templates.ts` | Agreement kinds (MSA/SOW/…): section text, acknowledgments, signer roles |
| `payments.ts` | Stripe via REST (no SDK dep): checkout session, webhook signature verify; manual-payment provider; invoice numbering |
| `files.ts` | Private-bucket signed upload/download URLs, versioning, mime/size validation, basic malware-aware screening |
| `automations.ts` | Automation registry (trigger/conditions/actions/delay/channel), `fireAutomation` with `dedupe_key` uniqueness, cron sweeps, failure logging, enable/disable + admin override |
| `notifications.ts` | In-app notification feed writers |
| `activity.ts` | `client_activity` feed writer |
| `progress.ts` | Project % from milestone completion (never hand-entered) |
| `reports.ts` | Scorecard assembly from `metrics`, month-over-month, goal progress; estimated/manual labeling |

## Routes

Public token flows (no login; unguessable 128-bit tokens; rate limited):
- `/start` — conversational qualification funnel → lead + opportunity + routing
- `/assessment/[token]` — business systems assessment (save/resume, invite teammate)
- `/prepare/[token]` — consultation preparation questionnaire
- `/proposals/[token]` — lifecycle proposal viewer (options, comments, approval,
  tracking). `/proposal/[token]` (singular) belongs to managed services.
- `/agreement/[token]` — e-signature flow (typed signature, acknowledgments, audit trail, content hash, print-ready signed copy)
- `/pay/[token]` — deposit/invoice payment (Stripe Checkout or recorded manual/ACH)

Portal (client session; every page checks `getSession` + live session):
`/portal` overview, `/portal/project`, `/portal/workspace` (requests+messages+files),
`/portal/support`, `/portal/training`, `/portal/reports`, `/portal/roadmap`,
`/portal/billing`, `/portal/team`, `/portal/invite/[token]` (teammate activation).

APIs: `/api/assessment`, `/api/questionnaire/[token]`, `/api/proposal/[token]`,
`/api/contract/[token]`, `/api/pay/[token]`, `/api/stripe/webhook`
(already CSRF-exempt in middleware, Stripe-signature verified), `/api/portal/*`, `/api/admin/lifecycle`
(section GET + action POST dispatch, RBAC + audit + rate limit, mirroring
`/api/admin/scheduling`). Cron work rides the existing `/api/cron/scheduling`.

## Admin

One new AdminConsole tab — **Client OS** (`LifecycleAdminPanel`) — with subtabs:
Pipeline, Assessments, Questionnaires, Proposals, Contracts, Billing, Clients &
Projects, Requests, Tickets, Training, Reports, Renewals, Automations, plus a
unified Client 360 record (full history from first submission onward).

New permissions in `lib/scheduling/permissions.ts`: `manage_projects`,
`manage_billing`, `manage_support`, `manage_training`, `manage_automations`,
`manage_proposals` — mapped onto the existing role matrix.

## Automations

Registry-driven. Every automation has: trigger, conditions, action, delay,
channel (email/in-app/both), failure handling (errors recorded on
`automation_runs`; emails fall back to the `email_jobs` retry queue), activity
logging, admin enable/disable + override. Duplicate suppression via a UNIQUE
`dedupe_key` per run (e.g. `proposal_reminder:PROPOSAL_ID:day3`). Event
automations fire inline at the mutation site; time-based automations are swept
by cron (questionnaire reminders, proposal expiry, signature reminders, payment
reminders, renewal reminders, ticket inactivity, report delivery).

## Security

- Client separation: every portal/token query scoped by `client_id`/token at a
  single choke point; tokens are `crypto.randomBytes(24)+` base64url.
- Payments: Stripe-hosted checkout only; webhook HMAC verification; no card
  data ever touches the app. Manual payments record references, never numbers.
- Signatures: typed-name + explicit acknowledgments + SHA-256 content hash +
  IP/UA/timestamp rows in `contract_signatures` and `contract_events`.
- Files: private bucket, signed URLs (short TTL), size/extension/mime
  allowlists, executable-type flagging; credential requests route to a
  dedicated secure flow — the UI never invites passwords into messages/files.
- Admin actions audited via `audit_events`; portal-visible history via
  `client_activity`.
- All mutating routes rate-limited; public token routes additionally
  IP-throttled; input validated with zod everywhere.

## Environment

Required beyond the existing set: none (degrades gracefully).
Optional: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (enables card/ACH
checkout; otherwise invoices support recorded manual/bank payments only),
`NEXT_PUBLIC_SITE_URL` for absolute links in emails.

## Testing

`npm test` includes `tests/lifecycle.test.ts`: qualification scoring/routing,
conditional-form logic, assessment scoring/summary, questionnaire templates
(including a "never solicit passwords" guard), and billing helpers.
Everything typechecks with `npm run typecheck`.

## Setup

1. Apply `supabase/migrations/20260717120000_client_lifecycle.sql` in the
   Supabase SQL editor (after the existing migrations). Until it is applied,
   every lifecycle page degrades to friendly fallbacks — nothing crashes.
2. (Optional) Set the Stripe env vars and point a Stripe webhook at
   `POST /api/stripe/webhook` with the `checkout.session.completed`,
   `payment_intent.payment_failed`, and `charge.refunded` events.
3. Vercel cron already hits `/api/cron/scheduling` every 5 minutes; lifecycle
   sweeps run inside it. No new cron entry needed.
4. Admin → Client OS → Automations to review which automations are enabled and
   their delays; Admin → Client OS → Billing to configure SLA targets.
