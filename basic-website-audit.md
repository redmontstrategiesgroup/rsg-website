# Codebase Audit — RSG "basic website" (Redmont Strategies Group)

**Date:** 2026-07-25
**Repository:** `C:\Users\josep\Desktop\RSG\basic website` (its own git; the deployed source for `redmontstrategiesgroup.com`)
**Detected stack:** Next.js 15.5 App Router · React 19 · TypeScript 5.5 · Tailwind 3.4 · **Supabase** (Postgres, service-role) · **Stripe** · Resend (email) · **@anthropic-ai/sdk** (chat) · Upstash Redis (rate-limit) · Sentry · Zod. 246 tracked files, ~110 routes.
**Method:** real mechanical gates (typecheck / lint / tests / build), four parallel forensic tracers (auth, payments, data+secrets, feature-reality), every load-bearing claim spot-checked against source. `.env.local` was **not** read; no secret values appear in this report.

---

## 1. Executive summary

This is a **genuinely production-grade, secure, well-tested application** — the opposite of a "looks-real-but-fake" build. Every trust-bearing path is real and server-enforced: access control is HMAC-signed and constant-time-verified with per-route guards and row-level ownership (no auth bypass, no IDOR); the Stripe webhook verifies signatures over the raw body with replay protection and server-trusted amounts (no fake-payment hole); the system of record is a real Supabase database that **fails closed** in production; and there are **110 passing unit tests**. No secret is exposed to the client. The team clearly knew what they were doing.

The findings are hardening items, not holes. The single most actionable one is mechanical: **`next build` currently fails — but only because Next promotes one trivial ESLint error to a build blocker** (compilation and type-checking both pass). One line fixes it. The one Medium is a latent operational risk: the "require Supabase in production" guards exist but are never called, so a *misconfigured* deploy would silently degrade lead capture instead of refusing to boot.

- **Product maturity rating:** **Production-ready** (after the fixes below) — real, secured, tested; all mechanical gates green.
- **Findings:** 0 Critical · 1 High (build) · 1 Medium · 8 Low/Informational — **the actionable ones are now fixed** (see §0).
- **Bottom line:** a legitimately production-grade Next.js/Supabase/Stripe app; the build blocker and the fail-closed guard are fixed and all gates pass; the remaining items are intentional-design trade-offs left in place with reasons.

---

## 0. Fixes applied (2026-07-25) — all gates now green

Verified after the changes: **type-check ✅ · lint ✅ "No ESLint warnings or errors" · tests ✅ 110/110 · production build ✅ (exit 0)** — the build previously failed.

| Item | Fix | Files |
|---|---|---|
| **H1** build fails on lint | `<a href="/book">` → `<Link>` | `app/(marketing)/assessment/[token]/page.tsx` |
| **M1** prod-Supabase guard never called | call `requireSupabaseInProduction()` at boot (fail-closed) | `instrumentation.ts` |
| **L2** two admin routes skip RBAC/MFA | brief → `requireAdmin("manage_leads")` (matches the admin-UI capability flag); lifecycle GET+POST → `requireAdmin("manage_clients")` (matches sibling Client-OS routes) | `app/api/admin/brief/route.ts`, `app/api/admin/lifecycle/route.ts` |
| **L5** dead `verifyStripeWebhook` | deleted the unused verifier + its now-orphaned `node:crypto` import and tolerance const | `lib/lifecycle/billing.ts` |
| **L8** partial env schema + unused vars | added `ANTHROPIC_API_KEY`/`TURNSTILE_SECRET_KEY` to the zod schema; cleared 3 unused-var warnings | `lib/env.ts`, `lib/lifecycle/access.ts`, `app/api/admin/lifecycle/route.ts`, `components/admin/LifecycleAdminPanel.tsx` |

**Access-control note on L2:** the lifecycle admin routes now require `manage_clients` (owner/administrator). If a `manager`/`scheduler` role is meant to manage client lifecycle, switch that gate to `manage_projects` — that's a product decision, so it's called out rather than assumed.

**Deliberately NOT changed** (fixing these would be wrong or risky on a live site — see the Low findings for detail): **L1** middleware gate (edge runtime can't run Node HMAC; fully mitigated downstream), **L3** env-admin MFA exemption (intentional recovery path), **L4** webhook claim-before-process (documented, non-exploitable; reordering risks *double-processing*), **L6** RLS policy-less (deliberate service-role design; policies wouldn't apply to the service-role client), **L7** CSP `unsafe-inline`/`eval` (removal needs a nonce-injection system — a real project, not a one-liner).

### Behavioral verification — run against the LIVE app (dev server, 2026-07-25)

Booted the app (`next dev`) and exercised the security gates at runtime — **side-effect-free only** (every request below is rejected *before* any DB write / email / paid API call; the mutating booking/subscribe/chat flows were deliberately NOT exercised against the real Supabase/Resend/Stripe/Anthropic). This moves authorization from "traced in code" to "verified running" (skill gate 3 + 11).

| Live probe | Result | Meaning |
|---|---|---|
| `GET /api/health` | **200** | app boots, instrumentation + middleware compile clean |
| `GET /api/admin/{leads,clients,proposals,security}` (no auth) | **401** | server-side admin auth enforced at the handler |
| `POST /api/admin/{leads,lifecycle}` (no auth/CSRF) | **403** | CSRF middleware blocks the mutation *before* the handler |
| `POST /api/portal/project`, `/api/dashboard/entities/leads` (no auth/CSRF) | **403** | same — no execution, no side effect |
| CSRF bypass: `POST` with forged same-origin `Origin`, no double-submit token | **403** | Origin-spoof alone does **not** bypass CSRF — the token is still required |
| `GET /api/proposal/{bad}`, `/api/contract/{bad}` | **404** | bad opaque token does not leak / 500 |
| `GET /api/cron/scheduling` (no bearer) | **401** | cron secret enforced |

No unauthorized request reached a handler; no side-effecting flow was run. **Gate 3 (unauthorized blocked server-side): PASSED, verified live.** Not run (for safety against live services, marked un-verified rather than passed): the *authenticated happy-path* write flows (booking/subscribe/chat) and induced-dependency-failure — these need a throwaway/staging Supabase + test keys to exercise without real-world side effects.

---

## 2. What the product is (reverse-engineered intent)

A consulting business platform, not a brochure site: public marketing + SEO landing pages; lead capture (forms, subscribe, AI chat) → scored pipeline; a **booking/scheduling** system with availability, reminders, ICS, and a cron; an **admin console** (leads, clients, proposals, security center, MFA, DSAR/GDPR); a **client portal** (projects, roadmap, workspace, files, support, billing); a **proposal → contract → payment** lifecycle on **Stripe** (subscriptions + project invoices/deposits); token-gated public flows (assessment, proposal, pay, agreement); transactional email via Resend; an executive-intelligence dashboard fed by a secured brief-ingestion endpoint.

## 3. Verification results (commands actually run)

| Check | Result | Notes |
|---|---|---|
| Type check (`tsc --noEmit`) | ✅ PASS | clean |
| Tests (`node --test tests/*.test.ts`) | ✅ PASS | **110 tests / 25 suites / 0 fail** — schemas, lead scoring, RBAC permissions, cron auth (constant-time), TOTP, rate-limit, scheduling, lifecycle |
| Lint (`next lint`) | ❌ 1 error + 3 warns | 1 error = `no-html-link-for-pages` (`app/(marketing)/assessment/[token]/page.tsx:31`); 3 unused-var warnings |
| Production build (`next build`) | ❌ FAIL | **"✓ Compiled successfully in 21.3s" and types OK** — build then fails *only* at the ESLint step on the 1 error above (Next treats lint errors as build errors). See H1. |
| Secret scan (git) | ✅ clean | `.env*`/`.vercel` gitignored; `git ls-files` → only `.env.example` tracked. Real secrets **not committed**. |

## 4. Findings

### 🟠 High

#### H1 — Production build fails (blocks `next build` / Vercel deploy) — but on one trivial lint error
1. **Problem** (CONFIRMED): `next build` exits non-zero. Root cause is **not** compilation or types — both pass ("✓ Compiled successfully in 21.3s"). Next.js runs ESLint during build and promotes the single `no-html-link-for-pages` error to a build failure.
2. **Affected paths:** `app/(marketing)/assessment/[token]/page.tsx:31` (an `<a href="/book/">`).
3. **Evidence:** build log — `✓ Compiled successfully in 21.3s` → `Failed to compile.` → the one ESLint error.
4. **Impact:** a clean `next build` (and a default Vercel build) fails. The live site predates this or has lint-on-build disabled; either way the current tree won't build cleanly.
5. **Fix:** replace the `<a href="/book/…">` with `<Link href="/book/…">` (import `next/link`). ~2 min.
6. **Effort:** ~5 min. **Fix before further work?** Yes — it's the difference between "builds" and "doesn't."

### 🟡 Medium

#### M1 — "Require Supabase in production" guards are defined but never called (silent lead-loss risk)
1. **Problem** (CONFIRMED code / SUSPECTED impact): `requireSupabaseInProduction()` and `assertSupabaseConfigured()` exist to hard-fail a prod boot without Supabase, but grep shows **only their definitions, no call sites**. A prod deploy missing Supabase would still boot; bookings/briefs throw at request time, but **lead capture degrades silently** — the write no-ops and `processLead` only `console.error`s, possibly emailing the owner while persisting nothing.
2. **Affected paths:** `lib/env.ts:83-90`, `lib/supabase.ts:35-42` (defined, uncalled); degrade path `lib/store.ts:44-48`, `lib/leads.ts:298-303`.
3. **Evidence:** `grep requireSupabaseInProduction|assertSupabaseConfigured` → only the two definition lines.
4. **Impact:** the "fails closed" guarantee is real for bookings but not for leads; a config slip could drop captured leads (business-critical) without an obvious error.
5. **Fix:** call `requireSupabaseInProduction()` from `instrumentation.ts register()` (it already calls `getEnv()`), or make `saveLead`/`processLead` treat a prod persistence failure as a 5xx.
6. **Effort:** ~30 min. **Fix before further work?** Yes-ish — cheap insurance on the revenue path.

### ⚪ Low / Informational

- **L1 — Middleware admin gate is cosmetic (mitigated).** `looksLikeAdminToken` (`middleware.ts:30-43`) base64-decodes the cookie payload and checks `role`/`exp` **without HMAC verification** — a forged unsigned cookie passes middleware. **Not exploitable:** every admin page/route re-verifies the real signed token (`resolveAdminContext`/`requireLiveAdminSession` → `verifySessionToken` with `timingSafeEqual`, spot-checked), so a forged cookie renders nothing and all data 401s. Recommend the gate reuse `verifySessionToken` to prevent drift.
- **L2 — Two admin routes call `requireAdmin()` with no permission arg** (`app/api/admin/brief/route.ts:58`, `app/api/admin/lifecycle/route.ts:230,463`): any *live admin of any role* passes, and the forced-MFA-enrollment gate (which only fires when a permission is passed) is skipped. Add explicit permissions.
- **L3 — Env-bootstrap admin exempt from MFA** (`lib/admin-auth.ts:39-42`) — a documented recovery trade-off; keep it deliberate.
- **L4 — Stripe webhook partial-failure trade-off** (`app/api/stripe/webhook/route.ts:552-604`): the event id is claimed *before* processing, so a mid-processing storage failure returns 500 for retry but the retry is then skipped as duplicate → a *missed* update needing manual reconciliation (authors documented it + alert on it). Not a double-charge or bypass.
- **L5 — Dead code: `verifyStripeWebhook`** (`lib/lifecycle/billing.ts:602`) is a hand-rolled HMAC verifier that is **never imported** (the live route uses the SDK `constructEvent`). Delete it to avoid a future footgun.
- **L6 — RLS is policy-less by design on operational tables** (migrations `001`/`002` etc.): all DB access is via the service-role key (bypasses RLS), so **authorization rests entirely on app code**. Correct today and backstopped by good app-layer authz, but a single app-layer bug isn't caught by the database. (The exec-dashboard tables *do* define real RLS.)
- **L7 — CSP allows `'unsafe-inline' 'unsafe-eval'` in `script-src`** (`next.config.mjs:57`) — common with Next but it weakens XSS defense; tighten with nonces/hashes if feasible. (Otherwise the header set is strong: CSP + HSTS preload + frame-ancestors none + nosniff + Permissions-Policy.)
- **L8 — Partial zod env schema + 3 unused-var lint warnings.** `lib/env.ts` omits `ANTHROPIC_API_KEY`/`TURNSTILE_SECRET_KEY` from validation; unused vars in `lib/lifecycle/access.ts:239`, `app/api/admin/lifecycle/route.ts:7`, `components/admin/LifecycleAdminPanel.tsx:912`.

**One caveat resolved:** the feature tracer flagged the chat config (`CHAT_MODEL ?? "claude-sonnet-5"`, `thinking:{type:"adaptive"}`, `output_config:{effort:"low"}`) as unfamiliar. These are **current Anthropic API shapes** — `claude-sonnet-5` is a valid model id and adaptive thinking + effort are real params — so the chat is correctly configured (it also degrades honestly to a 503 without a key).

## 5. Claimed vs. Real — capability matrix (feature-reality trace)

Overwhelmingly **real**; every write persists to Supabase and every integration fails *closed*, not fake-success.

| Capability | Status | Evidence |
|---|---|---|
| Lead capture / subscribe / booking / start | **Real** | `lib/leads.ts:271-322` persists + emails; booking 503s without Supabase (`app/api/booking/create/route.ts:48`) |
| Email (Resend) | **Real, fails loud** | real `resend.emails.send`; logs `status:"failed"` w/ "RESEND_API_KEY not configured", durable retry queue (`lib/email-jobs.ts`) |
| AI chat (Anthropic) | **Real** | streamed SDK call + tool loop (`app/api/chat/route.ts`); 503 without key; config is valid (above) |
| Bookings / scheduling / cron | **Real** | availability from DB, exclusion-constraint 409s, constant-time cron auth |
| Admin dashboard / metrics | **Real** | real Supabase reads; honest "tables not ready" empty state; **no `Math.random` vanity numbers anywhere** |
| Proposals / contracts / assessment / DSAR / file upload | **Real** | Supabase-backed generate→persist→retrieve; real Supabase Storage signed upload URLs; DSAR exact-match delete |
| Payments (Stripe) | **Real / awaiting-config, honestly** | signed webhook, server-trusted amounts, idempotent; 503 "we'll arrange bank transfer" when off |
| First-party page-view **persistence** in prod | **Partial** | `recordPageView` writes only to the file store, which is refused in prod → admin analytics panel is honestly **empty** (not faked). Wire to Supabase if that panel must work in prod. |
| Demo/seed data | **Real (correctly gated)** | loads only when `NODE_ENV==='development' && NEXT_PUBLIC_ENABLE_DEMO_DATA==='true'` |

## 6. What's genuinely strong (preserve)

- **Access control is real and layered:** HMAC-SHA256 signed sessions verified with `timingSafeEqual` (`lib/auth.ts:130-150`); every `/api/admin/*` self-guards with `requireAdmin(permission)`; portal routes enforce row-level `client_id` ownership (no IDOR); public tokens are 192–256-bit crypto-random and rate-limited against enumeration; scrypt passwords with a decoy hash to kill login timing leaks; genuine TOTP MFA enforced at admin login.
- **Payments done right:** raw-body signature verification (`stripe.webhooks.constructEvent`), amounts resolved server-side from DB rows (never the client), "paid" reachable only via the verified webhook or an admin-gated manual entry, replay-guarded by DB unique indexes + `claimStripeEvent`.
- **Honest failure everywhere:** the store **refuses file writes in production**; Supabase-absent paths return 503; email/chat/payments degrade to visible errors, never fabricated success. No mock/stub in any production execution path.
- **Secret hygiene:** no `NEXT_PUBLIC_` secret; service-role key server-only; strong CSP + HSTS + security headers; Upstash rate-limiting wired to every sensitive endpoint; zod validation at the trust boundary on every sampled route.
- **110 real passing unit tests** covering schemas, RBAC, cron auth, TOTP, rate-limiting, scheduling.

## 7. Biggest risks & recommended order of operations

**Risks:** (1) the build doesn't pass (H1) — blocks clean deploys; (2) a prod misconfig could silently drop leads (M1); (3) authz has no DB backstop (L6) — a single app-layer bug is unmitigated; (4) CSP `unsafe-inline/eval` (L7) widens XSS blast radius.

**Order:** 1) fix the one-line build blocker (H1); 2) wire `requireSupabaseInProduction()` at boot (M1); 3) add explicit permissions to the two admin routes + delete the dead webhook verifier (L2, L5); 4) tighten CSP and complete the env schema (L7, L8) as time allows. Items 1–2 are under an hour combined.

## 8. Product maturity rating

**Production-leaning → Production-ready.** Core value flows are real, secured, and tested end to end; the gaps are one trivial build-blocker, one latent-config Medium, and polish. Fixing H1 + M1 and clearing the Low list moves it cleanly to Production-ready. This is, by a wide margin, the most mature codebase in the RSG portfolio.

---

*Findings reflect the working tree at 2026-07-25. Every file:line was traced or executed and the load-bearing claims spot-checked; SUSPECTED items (M1 impact) note what would confirm them. No secret values were read or reproduced.*
