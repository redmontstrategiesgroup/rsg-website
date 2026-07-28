# Backend Dependency Plan — productizing all five RSG apps

**Date:** 2026-07-27 · **Decision recorded:** all five demo apps (GHOST, NEXUS, Observatory, THE FORGE, Onehand OS) get real backends. · **Method:** grounded in per-app inventories (`demo-to-production-inventory.md`) + a primitive-reuse audit of the existing production app at `basic website/`. Every "exists" claim below cites a real file.

> This plan *ensures all dependencies are accounted for* before construction. It is the dependency tree (what each app needs, marked **exists**/**create**), the build order, and the gates that block starting. It does not build anything yet.

---

## The architecture decision this forces

"All five need backends" makes **one** architecture correct: **a single shared backend platform that the five apps mount into as authenticated, tenant-scoped products — not five separate backends.** For a solo founder, standing up five auth systems, five databases, five billing integrations, and five ops stacks is the actual over-engineering.

**That platform already exists** — it is the production app at `basic website/` (Next.js 15.5 / Supabase / Stripe). The reuse audit found it already provides, reusable essentially as-is, **every** backend primitive the five apps need:

| Need | Reusable primitive (exists) | File |
|---|---|---|
| Require-logged-in-user + current tenant id | `requirePortalContext()` → `{client, user}` | `lib/lifecycle/access.ts` |
| Sessions (HMAC cookie), scrypt passwords, TOTP MFA | `getSession`, `setSessionCookie`, `hashPassword`… | `lib/auth.ts`, `lib/totp.ts` |
| Tenant isolation (service-role + `client_id` scoping) | portal query pattern | `app/api/portal/workspace/route.ts`, migrations |
| Supabase server client | `getSupabase()` / `requireSupabase()` | `lib/supabase.ts`, `lib/lifecycle/core.ts` |
| **Server-side Anthropic proxy** (key never in browser) | `new Anthropic()` streaming + tool-schema pattern | `app/api/chat/route.ts` |
| Billing (recurring + one-time), verified webhook | `lib/managed-services/billing.ts`, `lib/lifecycle/billing.ts` | `app/api/stripe/webhook` |
| Rate limiting, error monitoring, audit, health, cron, CI, fail-closed env | `lib/security.ts`, Sentry, `lib/audit.ts`, `app/api/health`, `vercel.json`, `lib/env.ts` | (see reuse audit) |
| CSRF gate + client helpers | `middleware.ts`, `lib/api.ts` (`postJson`) | — |

**Reconciling with `ecosystem-architecture.md`** (which argued *"no shared runtime services… none should be created"*): that judgment was explicitly for the *zero-backend, local, single-user demo* world, where the isolation story was "nothing shares a runtime." Deciding all five need real auth/tenancy/billing/ops **inverts** the trade — but the doc's core value is preserved: **each app's data stays isolated at the data layer** (`client_id`/tenant scoping, one app never reads another's rows) and each app keeps its own front-end and domain logic. Only the undifferentiated heavy lifting (auth, tenancy plumbing, the AI proxy, billing, ops) is shared. Shared *platform*, isolated *app data* — not a distributed monolith.

---

## Tenancy — the one decision that shapes the data model (needs your input)

The platform's current model is **one org (RSG) + *provisioned* client accounts** (a tenant = a row in `public.clients`; no self-serve signup, no anon Supabase client). Two paths:

- **A — Extend the existing model (recommended for v1).** The five apps become authenticated products inside the client portal, scoped by `client_id`. Reuses **everything** above verbatim. Fastest, cheapest, lowest-risk. Right if the audience is RSG's clients (or invite-only early users).
- **B — Add self-serve multi-tenant SaaS.** Arbitrary users sign up and create orgs. Requires new: public signup, email verification, an `orgs`/`org_members` model (or generalizing `client_id` → `tenant_id`), self-serve Stripe onboarding, and abuse controls. Larger; can be added per-app later *if* a product gets traction.

**Recommendation:** build v1 on **A**, using a `tenant_id` column name from day one (a trivial generalization of `client_id`) so a later move to **B** doesn't re-touch every table. Everything below assumes A unless you choose B. *This is your call — see the question in chat.*

---

## The dependency tree

### Tier 0 — Cross-cutting gates (must clear before/around construction)

| # | Dependency | Status | Owner | Blocks |
|---|---|---|---|---|
| G1 | **Regain Supabase dashboard access** (project `rsg website` / `xnhbrfbuvssxpciikhws`) via password reset | **create (user action)** | Joseph | anything touching live data/deploy |
| G2 | **Restore the 2026-07-27 backup into a dev/branch DB** and time the restore (repo migrations ≠ live; rebuild from `basic website/supabase/backup-2026-07-27/`) | **create** | me, after G1 (or against a local Supabase now) | realistic dev; verified-restore guardrail |
| G3 | **Tenancy decision (A vs B)** | **decide** | Joseph | per-app data model |
| G4 | **Secrets present in each env** — hard-required in prod: `AUTH_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; for AI apps `ANTHROPIC_API_KEY` (server) | partial | Joseph/me | boot (fail-closed) |
| G5 | **`NEXT_PUBLIC_ENABLE_DEMO_DATA=false` in prod** (the platform already has this flag) | **exists** | me | demo-data-leak guardrail |

### Tier 1 — Shared platform work (build once, all apps depend on it)

| # | Dependency | Status | Note |
|---|---|---|---|
| P1 | **Generic authenticated AI route helper** — factor `app/api/chat`'s server-side Anthropic pattern into a reusable `lib/ai/proxy.ts` any app route calls after `requirePortalContext()` | **create** (generalize existing) | removes the browser-key red flag for Forge/NEXUS/Observatory at once |
| P2 | **Per-tenant AI spend metering + caps** — count tokens per `tenant_id`, enforce a ceiling (extend `lib/security.rateLimit` + an `ai_usage` table) | **create** | the current key is uncapped/unattributed |
| P3 | **App-mount convention** — a route-group template `app/(portal)/<app>/*` (server page → `requirePortalContext()` → `redirect("/login")` → client component seeded with `tenant_id`; `robots:noindex`; `runtime=nodejs`) | **create** (pattern) | one worked example, then copy |
| P4 | **Per-app table pattern** — `<app>_*` tables with `tenant_id` FK + RLS-enabled/no-policies/`revoke` (matches existing convention) + always `.eq("tenant_id", …)` | **create** (pattern) | service-role bypasses RLS → scoping is mandatory in code |
| P5 | **Seed-behind-onboarding helper** — new tenants start empty; demo/sample data only under an explicit "load sample" action or `ENABLE_DEMO_DATA` | **create** | closes the leak guardrail for all five |
| P6 | **CSP / headers carve-outs** for embedded apps (three.js `worker-src`/`blob:`; any new external host in `connect-src`) | **create** (edit `next.config.mjs`) | needed by Forge (three.js) + any app calling a new host |

Ops (Sentry, rate-limit, `lib/audit`, `app/api/health`, cron, CI, fail-closed env, CSRF) — **all exist, inherited for free** by every new route.

### Tier 2 — Per-app dependencies

Each app needs: **(a)** a tenant-scoped data model (Supabase tables replacing its `localStorage` blob), **(b)** server API routes (persistence, and for AI apps the P1 proxy), **(c)** a front-end port (vanilla JS → React client component via `next/dynamic ssr:false`, or same-origin `<iframe>`), **(d)** seeding moved behind onboarding, **(e)** an optional billing plan (reuse Stripe), **(f)** any app-specific integrations. All AI apps must **drop their browser-direct key** and call P1.

| App | Core tables (replace its blob) | Front-end port | AI via P1? | App-specific / risk | Rel. effort |
|---|---|---|---|---|---|
| **Observatory** | `obs_scenarios`, `obs_reports`, `obs_calibrations`, `obs_imports` (all `tenant_id`) | classic scripts → client component; imports must isolate per tenant (today they mix into the shared synthetic world) | yes | cleanest; disclaimers already excellent | **M** (first mover — also proves Tier 1) |
| **THE FORGE** | `forge_projects`, `forge_revisions`, `forge_exports` (`tenant_id`) — today state is **in-memory only**, dies on refresh | ES modules + three.js → `next/dynamic ssr:false`; needs P6 (worker/blob CSP) | yes | safety-refusal policy already present; prices in `catalog.js` become config | **M–L** (three.js embedding) |
| **NEXUS** | `nexus_worlds` (one save row per player, `tenant_id`, world JSON, `v`, `saved_at`) | classic scripts → client component or iframe | yes | v1 = per-player save (simple). Server-authoritative multiplayer = separate large effort — out of scope unless chosen | **M** (single-player) |
| **Onehand OS** | `ability_profiles` (`tenant_id`) replacing `rsg.ability.v1`; **API key leaves the browser entirely** (platform `ANTHROPIC_API_KEY` + P2 metering, or per-tenant encrypted BYO-key) | becomes the **account hub / app launcher** inside the portal | n/a (it brokers) | collects disability data → needs consent + retention (legal) | **S–M** |
| **GHOST** | `ghost_worlds`, `ghost_missions`, `ghost_audit` (`tenant_id`, tamper-evident) | classic scripts → client component | n/a today | **⚠ separate sub-project:** real device/service **adapters** (SSH/RDP/KVM/ADB, Vercel/Stripe/Twilio) + credential custody + real authorization on approval gates. Its premise (authorized effects on a real fleet) is the portfolio's highest-risk surface | **XL** (adapters ≫ the app) |

---

## Build order (each phase ships independently; verify as a *second tenant* at every app)

- **Phase 0 — Gates.** G1 (regain Supabase access) ∥ G2 (restore backup to a dev/branch, time it) ∥ G3 (tenancy A/B). *Gate: you can sign into Supabase; a restored dev DB exists; tenancy chosen.*
- **Phase 1 — Platform prep (P1–P6).** Build the generic AI proxy, spend metering, the app-mount template, the per-app table pattern, the onboarding-seed helper, CSP carve-outs. *Gate: one throwaway `app/(portal)/hello` route boots behind auth, persists a `tenant_id` row, and calls Anthropic server-side with metering.*
- **Phase 2 — Observatory** (first real app; also hardens Tier 1). *Gate: log in as tenant A, create a scenario+report; log in as tenant B, confirm you cannot see A's data; seed only via explicit sample-load.*
- **Phase 3 — THE FORGE** (persistence + three.js embedding). *Gate: a project + revisions survive refresh and a different device; second-tenant isolation holds.*
- **Phase 4 — NEXUS** (per-player save). *Gate: two players get independent, durable worlds; neither can read the other's.*
- **Phase 5 — Onehand OS → account hub** (ability profile server-side; API key fully off the browser). *Gate: no `rsg.anthropic_key` in `localStorage` anywhere; ability data has consent + a retention rule.*
- **Phase 6 — GHOST** (last; its adapter/credential/authorization layer is a scoped sub-plan of its own — do **not** wire real effects until that plan is written and reviewed). *Gate: authorization on every approval; audit is tamper-evident; a real effect runs only against a sandbox target first.*

**Acceptance for the whole effort (skill Step 7):** sign up/log in as a brand-new tenant with no seeded state, complete each app's core flow, then repeat as a *second* tenant and confirm neither sees the other. That is the test the demos never had.

---

## What I can start now vs. what's gated

- **Now, safe, unblocked:** Phase 1 platform code can be scaffolded against a **local** Supabase (or the repo) without touching production — the generic AI proxy (P1), the app-mount template (P3), the table pattern (P4), and the onboarding-seed helper (P5) don't need live-DB access. I can also write the GHOST adapter/authorization sub-plan (design only).
- **Gated on you:** G1 (Supabase password reset) and G3 (tenancy A vs B). G1 blocks anything against the live DB and any deploy; G3 sets whether tables key on `client_id`/`tenant_id` (A) or need an `orgs` model + self-serve signup (B).

## Risks / caveats

- **Front-end porting is the real cost**, not backend construction — five vanilla-JS/`localStorage`/global-namespace (and one ES-module/three.js) apps must become React client components with server-API persistence. Estimate accordingly; the backend reuse is the cheap part.
- **GHOST is not a SaaS mount** — real fleet control is a distinct, security-critical build. Treated as XL and last; its real-effects layer is deferred to its own sub-plan.
- **`basic-website-audit.md` lists one build blocker (H1)** for the platform itself — clear it before deploying anything on top.
- **Verified restore before trust** (G2): an untested backup is a belief.
- Effort is relative (S/M/L/XL), not day-counts — precise numbers need the tenancy choice and the first Phase-1 spike.
