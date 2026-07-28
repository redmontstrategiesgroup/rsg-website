# Production Plan

**Scope:** whole repository — the Next.js product at `basic website/`, the five
browser apps (GHOST, NEXUS, Observatory, THE FORGE, Onehand OS), the `Website/`
static mirror, and the shared portfolio layer.

**Date:** 2026-07-28

## Current state

Measured, not assumed. Every number below came from a command run in this pass.

**`basic website/` — works, and is the only real product.** Next.js 15.5, 62 pages,
65 API routes, custom HMAC sessions + scrypt + TOTP, Supabase service-role data
layer, Stripe gated behind env presence, Sentry on all three runtimes, Upstash
rate limits with an in-process fallback. Baseline: `next lint` clean, `tsc
--noEmit` clean, `node --test` 157/157 pass, `next build` succeeds. `.env.example`
is complete and documents every variable `lib/env.ts` reads, including the
optional ones.

**The five apps — work, and are honestly labelled demos.** Zero backend, one
localStorage blob each, single implicit user, Anthropic key held in the browser
and said so in the UI at every point of use. Portfolio harness at
`shared/test-runner.html`: 4 apps boot clean, 188/188 assertions across 8 suites.

**Live database — sound, with one missed revoke.** Supabase `dyajmgddsiqcnlehqbhl`
(ref confirmed against `.env.local` before any query). All 110 public tables have
RLS enabled; the 111 `rls_enabled_no_policy` advisories are the intended deny-all,
because the app connects as service-role. But `anon` and `authenticated` still
hold blanket table GRANTs, so RLS is the only thing standing between the anon key
and every row — which makes the next item matter.

**Incomplete or dangerous:**

- `public.rsg_is_staff()` and `public.rsg_role()` are `SECURITY DEFINER` and
  executable by `anon` over `/rest/v1/rpc/…`. Every other `SECURITY DEFINER`
  function in the schema already has `anon` EXECUTE revoked — these two were
  missed, almost certainly because `authenticated` genuinely needs them (the
  `rsg_*` RLS policies call them). Impact is low on its own (both scope to
  `auth.uid()` and return `false` / `'none'` for an anonymous caller), but it is
  an unauthenticated entry point into a definer function and the only one left.
- `Website/` is a 4.5 MB static mirror that looks deployable and is not. Verified
  by file inspection, not by memory: `Website/businessconsulting/index.html`
  requests `_next/static/chunks/app/(marketing)/businessconsulting/page-…js`,
  and the only directory that exists on disk is
  `…/(marketing)/business-consulting-plymouth-county-ma/`. The HTML was migrated
  to short slugs; the compiled chunks were not. Every page in it 404s its own JS.
  It also duplicates `sitemap.xml` and `robots.txt` for a domain the real app
  already serves. Brand assets in it are byte-identical to `basic website/public/`
  (md5-checked), so nothing in it is unique except `seo-audit.md`.
- The outer repository has no `.gitignore` beyond `__pycache__/`. `basic website/`
  is currently untracked only because it is a nested git repo; it contains
  `.env.local` with a live Supabase service-role key, a live Anthropic key and a
  Vercel OIDC token. Nothing but that accident is keeping them out of a commit.
- The per-app Supabase scaffolding (5 × `supabase/{config.toml,migrations,functions}`,
  5 × `js/db.js`, 5 × `.env.example`) is uncommitted and has never been parsed,
  type-checked or run. `shared/supabase/validate.sh` exists for exactly this and
  has not been run.

## Target state

A repository where nothing present is misleading: the product verifies green from
a clean checkout, the live database exposes no unauthenticated definer function,
the only deployable artefact is the one that actually works, secrets cannot be
committed by accident, and the demo backend scaffolding is either validated or
labelled as unvalidated — never silently implied to work.

Explicitly *not* a target: turning the five demos into live products. That needs
five Supabase projects that do not exist, and nothing built against them could be
verified in this pass. Claiming otherwise is the failure mode this plan exists to
avoid.

## Decisions

- **Revoke `anon` only, keep `authenticated`.** The `rsg_*` RLS policies are `TO
  authenticated` and Postgres evaluates policy expressions with the caller's
  privileges, so revoking from `authenticated` would break tenant reads. `anon`
  has no policy referencing either function, so it loses nothing.
- **Delete `Website/` rather than repair it.** Repairing means regenerating an
  export that `basic website/` already produces correctly. A second copy of the
  marketing site is a permanent source of "which one is live?" — it has already
  caused that confusion twice. `seo-audit.md` moves to `docs/`; the rest is
  recoverable from git history.
- **Commit the per-app scaffolding, but only after validating what can be
  validated,** and label the rest in its own README. Deleting a real design would
  be worse; implying it runs would be worse still.
- **No live data writes.** The only live change is a `REVOKE`, applied as a
  migration so it exists in the repo too.
- **Nothing is pushed or deployed.** Verification here is local; shipping stays
  the owner's call.

## Work order

1. **Live security fix** — revoke `anon` EXECUTE on the two definer functions, as
   a repo migration applied via MCP. Re-run the Supabase security advisor and
   re-query `has_function_privilege` to confirm.
2. **Secret containment** — root `.gitignore` covering `.env*`, `node_modules/`,
   `.next/`, build output. Confirm by `git check-ignore` and a dry-run `git add`.
3. **Remove the broken mirror** — preserve `seo-audit.md`, delete `Website/`,
   leave a short note in `docs/` recording where the site actually builds from.
4. **Validate and commit the demo backend scaffolding** — run
   `shared/supabase/validate.sh`, fix what it catches, and write the honest README.
5. **The user walk** — primary journeys on the real app and the demo shell: narrow
   viewport, keyboard only, empty states, a protected route hit signed out, a
   protected API called without permission, double submit, garbage input.
6. **Re-verify** — lint, typecheck, tests, build, portfolio harness, from scratch.

## Out of scope

- **Backends for the five demos.** Requires five Supabase projects (~$50/mo) that
  the owner has deliberately not created yet, and could not be verified here.
- **Deploying or pushing anything.** Local verification only.
- **Stripe, Resend, Turnstile and Anthropic live calls.** Only the Supabase project
  was confirmed reachable for this pass; those paths are exercised by their unit
  tests and by env-presence gating, not against the live providers.
- **The `xnhbrfbuvssxpciikhws` project's three stray empty tables.** Out of reach —
  the connector no longer resolves that organisation.
