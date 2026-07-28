# RSG Portfolio — Demo → Production Conversion Inventory

**Date:** 2026-07-27 · **Method:** six parallel code inspections (one per product), every claim grounded in `file:line` read this session; cross-checked against `ecosystem-architecture.md`, `CONTRACTS.md`, `basic-website-audit.md`, and the two project memories (Supabase, URL migration). · **Confidence:** High for code-level claims; the Website's *live* backend state is Medium (asserted from memory + repo, see §7).

> This is the Step-1 artifact of a demo→production conversion: the honest scope, produced **before** anyone commits to a launch date. It does not convert anything. Its job is to make the operational and tenancy work visible while it is still cheap to act on.

---

## TL;DR — this is two different problems, not one

The six "products" split cleanly:

- **Five are genuine zero-backend demos** — GHOST, NEXUS, Observatory, THE FORGE, and the Onehand OS shell. Each is a single-user browser app whose entire state is one `localStorage` JSON blob, with **no auth, no server, no tenancy, no operational layer, and the Anthropic key sitting in the browser**. Converting *any* of them to a real multi-customer product is a **from-scratch backend build that is larger than the app itself** — exactly the shape this skill warns about. Their *feature logic* is real and (post the recent hardening pass) honestly labeled; the gap is entirely the productization tier.

- **One is not a demo at all — it is an already-built production app.** The RSG Website's real source is checked out locally at **`basic website/`** (Next.js 15.5 / React 19 / Supabase / Stripe; **61 page routes + 59 API routes**, 18 SQL migrations, custom HMAC auth + TOTP MFA, verified Stripe webhook, Sentry, Turnstile, Resend; GitHub `redmontstrategiesgroup/rsg-website.git`, Vercel project `rsg-website`). The `Website/` folder in this repo is only a **stale static mirror** of its marketing subset — and that mirror is now **mechanically broken** (see §7). Here the "conversion" is not building a product; it is **operational**: regain control of the live backend and stop shipping the broken mirror.

**So the real decision is not "how do I convert these."** It is: **which one demo, if any, earns a backend?** For a solo consultancy whose product is the Website and whose apps are capability demos that *drive* Website bookings, the default answer may well be "none of them yet — keep them as demos." That is a legitimate, cheap outcome, and naming it now is the point of this inventory.

---

## Tenancy — the decision to make first (per product)

The skill's rule: **decide tenancy before any further schema work**, because retrofitting a tenant identifier into an existing schema and every query is dramatically more expensive than starting with it. None of the five apps has *any* schema yet, so the cost of deferring is "you build the wrong data model." Recommendations below are mine to inform your call — the business decision is yours.

| Product | Who the paying customer would be | Recommended tenancy model | Cost if deferred |
|---|---|---|---|
| **Website** | RSG's own clients | **Already decided in the built app:** single operator org (RSG) + *provisioned* client accounts, per-client `client_id` row isolation. Keep it. | n/a (built). Going *self-serve multi-tenant SaaS* would be a large new effort with no current signal it's wanted. |
| **THE FORGE** | Makers/engineers (many, self-serve) | **Multi-tenant SaaS** — this is the most product-shaped app. | High — every project/revision table and query must carry a tenant id. Decide before the first schema line. |
| **Observatory** | Analysts/firms (B2B, per-org) | **Multi-tenant**, per-org analyses/reports. Small surface, clean seed isolation. | High (same reason), but the surface is small. |
| **NEXUS** | Players | **Either**: stay single-player-per-browser (a demo/toy, no tenancy) *or* server-authoritative multiplayer (very large). | Only relevant if you decide it's a game business. |
| **GHOST** | Ops teams controlling real fleets | **Multi-tenant AND real integrations** — highest stakes in the portfolio. | Enormous — and tenancy is the *smaller* half; see §6. |
| **Onehand OS** | (Infrastructure, not a standalone product) | It becomes the **auth + credential-broker front door** *if* the suite ever gets a real backend. | n/a standalone. |

**Largest single item across the portfolio:** for the five apps it is a tie between **tenancy** and **the operational layer** — both are "L, greenfield, from zero." For GHOST specifically it is **real integrations with credential custody** (§6).

---

## The four demo gaps, across all five apps

Every one of the five apps exhibits the same four gaps. This is the shared baseline; per-app specifics follow in the inventories.

**1 — Single tenancy assumed.** One implicit user, one save, no owner field anywhere. `nexus_world_v1`, `ghost:v2`, `obs_store_v1`, Forge's in-memory `state`, the shell's `rsg.*` keys — all per-browser, none scoped to an account.

**2 — No real authentication or authorization.** Zero auth in any app. Where access controls *appear* to exist they are decorative and self-describe as such: Observatory's `viewer/analyst/admin` roles are a free `<select>` the user can change (README: *"honest bookkeeping, not security"*); GHOST's approval gates resolve on any button click with actor hardcoded to the string `"operator"` (`orchestrator.js:195-212, 198`).

**3 — Integrations with the credential in the browser.** The three AI apps (Forge, NEXUS, Observatory) call the **real** Anthropic API — correctly, with genuine offline fallbacks — but with `anthropic-dangerous-direct-browser-access: true` and the API key read from `localStorage`. `CONTRACTS.md:70-72` acknowledges any same-origin XSS can read it. The Onehand OS shell **writes that shared key as a plaintext `localStorage` string** (`index.html:436`), where every launched iframe app can read it. Moving the key server-side (a proxy) is a portfolio-wide prerequisite, not a per-app task.

**4 — No operational surface.** No logging, error reporting, health checks, monitoring, alerting, backups, secrets management, env config, or deploy automation in any app. `serve.py` is a loopback static file server that *suppresses its own request logs* (`Onehand OS/serve.py:25-26`). Failures would be discovered by users; there is nothing to roll back to.

### ⚠ Two guardrail red-flags to record now

- **Seed data would leak into real accounts.** Every app seeds a fixed world into its single global blob with **no owner field**. GHOST is the sharpest: a second customer served from a fresh origin would inherit *Joseph's entire RSG world verbatim* — fleet, clients, leads, credential-reference entities, and audit history (`world.js:122-220`, gated only by a per-origin `seeded` flag). NEXUS hands every browser the identical 30-resident city; Observatory replays user CSV imports **into** the shared synthetic world graph on every boot (`app.js:50-53`); Forge auto-forges a demo deck into the workspace on boot (`main.js:1227`). **Guardrail: never launch with demo data reachable in a real account.** For all five, seeding must move behind onboarding/empty-state before any persistence is added.
- **The shared API key is a plaintext, uncapped, unattributed credential** on a single origin. Whoever pastes it bears all Anthropic spend, and any app's XSS can exfiltrate it. This is the security precondition for the whole suite.

---

## Per-product inventories

### 1 · Website — *not a demo; a built product with an operational gap*

**Tenancy:** decided (operator org + provisioned client accounts). **Source:** real, at `basic website/` — **not** missing. The `Website/` mirror is a stale snapshot of the marketing pages only.

| Area | State in the built app (`basic website/`) | Effort remaining | Blocking? |
|---|---|---|---|
| Data & persistence | Supabase; 18 repo migrations + a captured full backup | S (built) | no |
| Identity & access | Custom HMAC session cookies, scrypt passwords, TOTP MFA for admin | S (built) | no |
| Tenancy | Per-client `client_id` row isolation; RBAC admin | S built / **L** only if self-serve SaaS | no |
| Integrations | Native booking funnel, Turnstile, Anthropic chat, Resend, analytics beacon | S (built) | no |
| Hard-coded specifics | RSG name, `redmontstrategiesgroup.com`, phone `+17815880972`, Plymouth County, crimson `#b3243a` + 3 fonts, JSON-LD | **M** *only if* templated for reuse | no |
| Operational | Vercel, Sentry (DSN optional), Upstash rate-limit (optional), `vercel.json` crons | S (built) | **see §7** |
| Billing | Stripe + signed webhook + `pay/[token]`, config-gated | S (built) | no |
| Legal | Real `/privacy` (names real subprocessors) + `/terms` + working cookie-consent banner + DSAR endpoints | S (built) | no |

**Biggest gap here is not code — it is operational control of the live backend (§7).**

### The five demo apps — shared baseline

For all five, the inventory below is essentially identical. Rather than repeat it, here is the shared state; per-app notes call out only what differs.

| Area | Status (all five) | Effort | Blocking a real product? |
|---|---|---|---|
| Data & persistence | **Missing** — single `localStorage` blob; dies on a different device; version bumps *discard* data, no migrations, no constraints | **L** | yes |
| Identity & access | **Missing** — no auth; any "roles/gates" are decorative | **L** | yes |
| Tenancy | **Missing** — one implicit user, no owner field | **L** | yes |
| Integrations | **Partial** — real Anthropic calls with good fallbacks, but key is browser-side; no metering (GHOST: zero real integrations — all simulated) | **M** (GHOST **L**) | yes |
| Hard-coded specifics | **Partial** — brand/model-ids/seed baked in; varies by app | S–M | no |
| Operational layer | **Missing** — nothing | **L** | yes |
| Billing | **Missing** | M | yes |
| Support tooling | **Missing** | M | soon-after |
| Legal/compliance | **Missing** (Onehand OS also collects disability data with no consent) | S–M | yes |
| Demo/seed data | **Leak risk** — seeds into shared blob, no owner (see red-flag above) | S–M | **yes — guardrail** |

**Per-app, what's unique:**

### 2 · THE FORGE
Most product-shaped. **Biggest gap:** the entire engineering project (spec, *every* revision, validation state, export gates) lives in one in-memory JS object (`main.js:26-52`) that **evaporates on refresh** — Forge doesn't even persist to `localStorage`, so it's the furthest from "survives a refresh" of the group. Already has a real **safety-refusal policy** (`complexity.js:14-57`) that partly substitutes for a compliance layer — a genuine head start. Hard-coding is localized (`catalog.js` prices/MPNs + brand tokens); "Forge" is the product name, not a client's. ~5,200 LOC.

### 3 · Observatory
Cleanest of the five. **Biggest gap:** replace the single-blob `obs_store_v1` with a server + DB + real auth/tenancy. Two mitigating strengths: seed data is openly labeled `SYNTHETIC` everywhere, and the **reliability-disclaimer discipline is excellent** (mandatory assumption review that throws if unconfirmed, hedged-language rules, model-limitations section in every report) — most of the "decision-tool honesty" a B2B buyer would demand is already there. Watch: user CSV imports mix into the shared synthetic graph — hard-isolate per tenant. ~3,000 LOC.

### 4 · NEXUS
A game. **Biggest gap:** there is no server tier at all — real multiplayer means server-authoritative simulation + per-player world instancing built from scratch. The sim logic itself is real (the recent H2 economy fix is guarded by `economy-test.html`). Honest call: this is a portfolio demo unless there's a game-business thesis. ~2,900 LOC.

### 5 · GHOST — *highest stakes in the portfolio*
**Biggest gap is categorically different.** GHOST's premise — issuing *authorized, verified* commands to a real fleet — is entirely simulated: every "effect" is a `localStorage` mutation and every "verification" re-reads that same `localStorage` (`orchestrator.js` applyEffect/undoEffect). A real version needs genuine device/service **adapters** (SSH/RDP/KVM/ADB; Vercel/Stripe/Twilio), real credential custody, real authorization on the approval gates, and a **tamper-evident** audit log (today's audit is an in-blob array capped at 2000, shipped nowhere). This is not a SaaS conversion; it is effectively a new, security-critical company. The RSG/Joseph seed world is pervasive across `world.js`/`data.js`/`viz.js` and would leak wholesale to a second tenant. ~3,200 LOC.

### 6 · Onehand OS shell
Not a standalone product — it's the launcher (iframes apps from `apps.json`) and the **sole writer of the shared API key**. **Biggest gap:** that key is a plaintext `localStorage` string on a shared origin (`index.html:436`); the real move is to replace both it and the per-browser ability profile with a server-side authenticated per-tenant secret broker that proxies Anthropic calls so the credential never reaches the browser. Also collects **disability/medical-adjacent data** (usable fingers, grip, fatigue, reach) with no consent/retention — a sensitive-data obligation the moment there are real users. Note: the `apps/` stale-copy risk from the architecture doc **no longer exists** (verified absent). ~670 LOC.

---

## Portfolio roll-up

**Distance to production (closest → furthest):**

1. **Website** — already there in code; blocked only on operational control (§7).
2. **Observatory** — smallest surface, cleanest seeds, disclaimers done; still a full backend build.
3. **THE FORGE** — most saleable standalone; must add persistence *and* the whole stack.
4. **NEXUS** — needs a server-authoritative rewrite for multiplayer, or stays a demo.
5. **Onehand OS** — its "conversion" is really the suite's shared auth/credential-broker.
6. **GHOST** — furthest *and* highest-risk: real fleet control is a different universe of liability.

**The effort reality to internalize:** for apps #2–#6, the auth + database + tenancy + operational layer is **each individually larger than the app's existing feature code**. Five near-identical greenfield backends is not five small jobs; it is why the honest recommendation is to convert **at most one**, chosen by a revenue thesis, and keep the rest as demos.

**What's genuinely shared (build once, if you build at all):** a server-side **Anthropic proxy + per-tenant key custody + spend metering** (removes red-flag #2 for Forge, NEXUS, Observatory, and the shell simultaneously), and the **seed-behind-onboarding** pattern (removes red-flag #1 for all five).

---

## §7 · The Website's real blockers (operational, not code)

The built app is production-grade in *code*. Two things stand between it and "operable by you, today," both from the current project record — **verify before relying on either**:

1. **Lost control of the live backend.** The backend is Supabase project **`rsg website`** (ref `xnhbrfbuvssxpciikhws`, org `redmont strategies group`, Pro). As of 2026-07-27 the **dashboard login for the owning account was lost** (recovery = password reset, likely `josephpoday@gmail.com` or GitHub/Google SSO). The connected Supabase MCP token still had read access but could vanish on rotation. **You cannot fully operate — or safely migrate — a backend whose dashboard you can't sign into.** This is the first thing to fix.
2. **Live DB ≠ repo migrations.** The 18 files in `basic website/supabase/migrations/` do **not** reproduce the live database — they omit the entire `rsg_*` voice-agent/CRM subsystem that holds most real data. Rebuild/restore from the **captured full backup** at `basic website/supabase/backup-2026-07-27/` (104 tables, 142 RLS policies, 467 rows), **not** from the migration folder. The backup is a real asset — but per the skill's guardrail, *"an untested backup is a belief"*: a restore should be performed and timed before it's trusted.
3. **The `Website/` mirror is broken — do not deploy it.** It stages a slug migration (hyphenated geo-slugs → concatenated no-hyphen slugs) that is (a) an **SEO regression** (Google wants hyphen word-separators; `medspabusinessconsultingaiautomation` can't be tokenized) and (b) now **mechanically broken**: the HTML was migrated to short-slug dirs but the compiled `_next` chunks were not, so page JS 404s if served. Production still serves the old hyphenated URLs (200). **Ship from `basic website/` source, not this mirror**; if shortening slugs, keep hyphens and add 301s.

---

## What to decide before committing to any launch date

1. **Which single app (if any) earns a backend?** Everything downstream depends on this and on its tenancy model (table above). "None — keep them as demos" is a valid, cheap answer.
2. **Website: regain Supabase dashboard access** (password reset) and **perform + time a restore from the 2026-07-27 backup.** Until both are done, the Website is not operationally yours.
3. **If any app is chosen:** build the shared Anthropic proxy + key custody first (it's a precondition, not a feature), and move seeding behind onboarding (guardrail) before writing a single persistence path.

## Not assessed / caveats

- **Live Supabase schema and data** were not re-queried this session — §7 relies on the 2026-07-27 memory + repo; verify against the live project once access is restored.
- **`basic-website-audit.md`'s "production-ready / 110 tests passing"** was read, not re-run. The audit notes one build blocker (H1) to clear before it builds.
- **Effort is S/M/L, deliberately not day-counts.** Every "L" here is greenfield-from-zero; precise estimates require choosing the target and stack first (skill Step 2+).
- The five apps' *feature logic* was spot-checked as real (and was the subject of the recent hardening pass), not exhaustively re-audited — this inventory is about the productization tier, which is uniformly absent.
