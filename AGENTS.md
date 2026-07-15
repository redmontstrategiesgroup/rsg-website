# AGENTS.md

## Cursor Cloud specific instructions

This is a single Next.js 15 (App Router, React 19) marketing site for "Redmont
Strategies Group" with a demo client portal, an admin console, a contact/lead
funnel, and an Anthropic-powered chat widget. There is one service.

### Run / build / test
- Dev server: `npm run dev` (http://localhost:3000). Standard scripts live in `package.json`.
- Build: `npm run build`. Type-check only: `npx tsc --noEmit`.
- Lint: `npm run lint` is **not usable non-interactively** — no ESLint config is
  committed, so `next lint` drops into an interactive setup prompt. Use
  `npx tsc --noEmit` for static verification instead (do not add ESLint config
  just to lint).

### Local env (`.env.local`, gitignored)
- Everything runs without secrets, but two things need env vars locally:
  - `AUTH_SECRET` — sessions. If unset in dev, a random per-process secret is
    generated (sessions reset on server restart). Set it to keep sessions stable.
  - `ADMIN_EMAIL` + `ADMIN_PASSWORD` (8+ chars) — required to seed the admin
    account for `/admin/login`. Without them `/admin` fails closed (no default creds).
- All external integrations are optional and degrade gracefully when unset:
  `ANTHROPIC_API_KEY` (chat), `RESEND_API_KEY` (lead emails), `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` (durable leads), Cloudflare Turnstile keys. See
  `.env.example` and `LAUNCH.md` for details.

### Non-obvious gotchas
- Mutating API calls (`POST/PUT/PATCH/DELETE` under `/api/*`) are gated by
  `middleware.ts`: it blocks bot/scripted user-agents (curl, wget, python, etc.),
  enforces same-origin `sec-fetch-site`, and requires a CSRF double-submit token
  (`rsg_csrf` cookie echoed in the `x-csrf-token` header). **curl/script testing
  of these endpoints returns 403 "Request blocked." — test mutating flows in a
  real browser.** GET endpoints and page routes are fine to hit directly.
- `/api/auth/logout` and `/api/admin/logout` are POST-only; opening them via a
  browser GET returns HTTP 405. Use the in-app "Sign out" button.
- Data is stored in a gitignored file store under `data/` (seeded on first run).
  Demo portal accounts: `demo@glowaesthetics.com` / `client@apexdental.com`,
  shared password `redmont2026`. Admin/portal data in `/admin` tabs reads this
  file store (empty on a fresh checkout until seeded/used).
