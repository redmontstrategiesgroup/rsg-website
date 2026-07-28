# Managed Services & Recurring Billing

RSG's recurring-service platform: four monthly plans (Maintain, Optimize,
Scale, Managed Infrastructure), subscriptions with Stripe billing, service
requests with SLAs, maintenance/hours tracking, monthly reports, quarterly
roadmaps, and a tokenized proposal system.

## Architecture

| Layer | Location |
|---|---|
| Domain types | `lib/managed-services/types.ts` |
| Content, comparison matrix, FAQ, default plans | `lib/managed-services/content.ts` |
| Data access (Supabase-first, dev file fallback) | `lib/managed-services/store.ts` |
| Plan recommendation engine | `lib/managed-services/recommend.ts` |
| Stripe integration (env-gated) | `lib/managed-services/billing.ts` |
| Proposals | `lib/managed-services/proposals.ts` |
| Billing emails (Resend) | `lib/managed-services/emails.ts` |
| Portal payload builder | `lib/managed-services/portal-data.ts` |
| Schema + plan seed | `supabase/migrations/20260716220000_managed_services.sql` |

**Pricing is never hard-coded in components.** Plans live in
`managed_service_plans` (admin-editable in the Managed Services admin tab);
`lib/managed-services/content.ts` `DEFAULT_PLANS` is only a read-only dev
fallback when Supabase is unconfigured.

## Surfaces

- **Marketing:** `/managedservices` (hero, why-ongoing, plan cards,
  comparison table, how-it-works, FAQ + JSON-LD). Reusable
  `AfterLaunchSection` ("What Happens After Launch?") appears on the services
  page, the Private AI page, and six local service pages via
  `SERVICE_PLAN_RECOMMENDATIONS`.
- **Booking funnel:** step 3 has an optional "Ongoing support & management"
  question group; answers persist to `leads.service_plan_answers` and the
  auto-recommendation to `leads.recommended_plan` (admin-editable in the
  leads panel and via `PATCH /api/admin/leads/[id]`).
- **Client portal:** "Plan & Services" tab (plan/status/renewal, hours meter,
  requests with SLA + inclusion badges, maintenance, published reports,
  roadmap approval, billing history, upgrade recommendations, request/upgrade/
  cancellation modals). Printable report at `/portal/reports/[id]`
  ("Download PDF" = print-to-PDF).
- **Admin:** AdminConsole → Managed Services tab (overview MRR/ARR, plans,
  subscriptions, requests, maintenance, reports, roadmaps, proposals).
  APIs: `/api/admin/managedservices`, `/api/admin/proposals`
  (`manage_billing` permission = owner/administrator).
- **Proposals:** tokenized public page `/proposal/[token]` supporting
  implementation-only, monthly-only, combined, and project-completion kinds.
  Accepting the recurring scope creates the subscription (+ Stripe checkout
  when configured); deposits use one-time checkout.

## Stripe

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (see `.env.example`).
Without them everything still works on manual/invoiced billing — online
payment buttons are hidden.

- Checkout: subscription mode with inline `price_data` (product per plan via
  `rsg_plan_key` metadata); setup fees ride the first invoice.
- Webhook `POST /api/stripe/webhook`: signature-verified on the raw body
  (`constructEvent`, 5-min timestamp tolerance) plus replay protection via a
  unique `subscription_events.stripe_event_id` claim. CSRF middleware exempts
  this path (it authenticates by signature instead).
- Handled events: `checkout.session.completed` (activation; for
  project-completion proposals also creates the baseline report draft and a
  first-review request), `invoice.paid` / `invoice.payment_failed` /
  `invoice.finalized` (billing history + client/admin failure emails; Stripe
  smart retries handle re-charging), `customer.subscription.updated/deleted`.
- Upgrades are prorated in place; downgrades take effect at renewal via
  request. **Business-critical plans (Managed Infrastructure) can never be
  self-serve downgraded or cancelled** — the portal requires an acknowledged
  request and the server enforces it.

## Auditability

Every subscription lifecycle change writes a `subscription_events` row
(actor: `admin:<email>`, `client:<id>`, `stripe`, or `system`), and all admin
mutations additionally go through `writeAuditEvent`. Invoices sync into
`subscription_invoices` with Stripe-hosted PDF links.

## Tests

`tests/managed-services.test.ts` covers the recommendation engine, plan-data
integrity (comparison matrix completeness, exactly one recommended plan),
request inclusion/SLA rules, and upgrade-recommendation logic. Run with
`npm test`.
