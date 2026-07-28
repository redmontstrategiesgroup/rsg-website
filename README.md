# Redmont Strategies Group

The firm's website, client portal, and internal operations console — one Next.js application serving three audiences: public visitors, engaged clients, and staff.

Full documentation: **[docs/project-ebook.md](docs/project-ebook.md)**

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Supabase (PostgreSQL) · Stripe · Anthropic · Resend · Sentry · Vercel

## Quick start

```bash
npm ci
```

```bash
cp .env.example .env.local
```

Generate a session secret and put it in `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` so you can sign into the console. Everything else can stay empty — the app runs without Supabase, Stripe, Anthropic, or Resend, and each feature degrades with an honest "not configured" path rather than failing.

```bash
npm run dev
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Node test runner (157 tests) |

CI runs lint, typecheck, test, and build on every push and pull request.

> Run only one dev server or build per checkout at a time. Two Next processes sharing `.next` corrupt it and produce `ENOENT: routes-manifest.json` or `Cannot find module './NNNN.js'`.

## Database

Migrations are in `supabase/migrations/`, applied in filename order via the Supabase CLI or dashboard. Apply them to a fresh project before pointing the app at it. Migration files record intent — confirm parity with the live database rather than assuming it.

## Environment

`.env.example` documents every variable. Two are non-negotiable in production:

- `AUTH_SECRET` — signs session cookies. The app refuses to start without it.
- `NEXT_PUBLIC_ENABLE_DEMO_DATA` — must be `false`. It seeds sample portal accounts.

The full table, with development and production behavior for each variable, is in [section 10 of the ebook](docs/project-ebook.md#10-environment-configuration).

## Deployment

Vercel. `vercel.json` declares two cron jobs (`/api/cron/scheduling` every 5 minutes, `/api/cron/registry` daily), both requiring `CRON_SECRET`. Apply migrations before deploying code that depends on them — a rollback does not reverse them.

See [section 12](docs/project-ebook.md#12-deployment) for the full procedure and post-deployment verification.

## Documentation

| Document | Covers |
|---|---|
| [docs/project-ebook.md](docs/project-ebook.md) | Complete technical and product guide |
| [docs/client-lifecycle.md](docs/client-lifecycle.md) | Proposal → subscription → active client |
| [docs/managed-services.md](docs/managed-services.md) | Plans, subscriptions, roadmaps, reports |
| [docs/scheduling.md](docs/scheduling.md) | Availability, qualification, booking |
| [docs/webhooks.md](docs/webhooks.md) | Outbound webhook signing and retries |
| [docs/integration-triage.md](docs/integration-triage.md) | Diagnosing a failing integration |
| [docs/app-mount-pattern.md](docs/app-mount-pattern.md) | Mounting a standalone app in the portal |
| [DASHBOARD.md](DASHBOARD.md) | Executive intelligence dashboard ingestion |
| [LAUNCH.md](LAUNCH.md) | Original launch runbook |
