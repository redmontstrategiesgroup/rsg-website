# Per-app Supabase — one database per product

**Decision, 2026-07-27:** each RSG app gets its **own Supabase project**, its **own
auth**, and its **own database**. This replaces the app-mount plan in
`basic website/docs/app-mount-pattern.md`, which put all five apps into the website's
database as tenant-scoped tables.

Nothing was lost in the reversal: no app table was ever created in the website DB. The
only shared-platform work that had landed is the AI proxy and usage metering
(`ab1528b`, `6df59f8`, `c8dffc9`), and this document says what happens to it.

---

## 1. Project topology

Six Supabase projects in org **redmont strategies group** (`hauyxdkkeycbzoyizrdz`),
region `us-east-2` to match the existing one:

| Project | Ref | Owns |
|---|---|---|
| `rsg website` | `xnhbrfbuvssxpciikhws` (exists) | clients, billing, scheduling, CRM. **Source of truth for who a client is.** |
| `rsg-ghost` | *to create* | GHOST world model, plans, runs, audit |
| `rsg-nexus` | *to create* | NEXUS city saves |
| `rsg-observatory` | *to create* | Observatory scenarios, reports, calibrations |
| `rsg-forge` | *to create* | THE FORGE specs, revisions, exports |
| `rsg-onehand` | *to create* | Onehand OS ability profile + app grants |

Cost: **$10/month each, $50/month total** on top of the existing Pro plan.

### Why this shape is a good fit for these apps

The five apps are zero-build vanilla-JS browser apps. The mount plan required routing
every one of them through a Next.js server, because the website's DB is reachable only
by service-role key — a key that can never touch a browser.

With a project per app, each app's browser talks to **its own** Supabase directly using
the **publishable (anon) key**, and **RLS** does the isolation. That is what the anon key
is designed for. Consequences worth naming:

- **No server to build.** The apps stay static files behind `serve.py` or any CDN.
- **Isolation is enforced by the database**, not by remembering to write
  `.eq("client_id", …)` on every query. The mount pattern's own doc admits that risk:
  *"forgetting the filter is a cross-tenant leak; the database will not catch it."*
  Here it does.
- **Blast radius per app.** A bad migration in NEXUS cannot take down booking.
- **One app is sellable alone** without carving it out of a shared schema later.

What it costs: identity is now five auth stores instead of one (§2), and anything that
needs to join app data to billing data crosses a project boundary (§3).

---

## 2. Identity — standalone auth, shared registry

Each app project runs **its own Supabase Auth**. A person signing into NEXUS is a row in
`rsg-nexus`'s `auth.users` — unrelated to their row in `rsg-ghost`.

To keep billing and support able to answer *"which client is this?"*, every app DB
carries a **mirror of the client registry**, pushed from the website:

```
rsg website  ──(outbox → signed push)──▶  rsg-ghost.rsg_clients
  clients                             ├─▶  rsg-nexus.rsg_clients
  (source of truth)                   ├─▶  rsg-observatory.rsg_clients
                                      ├─▶  rsg-forge.rsg_clients
                                      └─▶  rsg-onehand.rsg_clients
```

- `rsg_clients` is **read-only downstream**. Apps never write it; they reference it.
- A local `auth.users` row is linked to a registry client by `app_users.client_id`.
  That link is what makes an app account "a client's account" rather than a stranger's.
- `app_users.client_id` is **nullable on purpose**. A self-serve signup with no RSG
  client behind it is a legitimate state — it is how an app gets sold standalone. Code
  must not assume the link exists.

**Trade-off accepted:** a client has a separate login per app, and MFA is enrolled per
app. If that becomes a support burden, the fix is an OIDC bridge with the website as
provider — the registry mirror is already the join key that migration would need, so
this choice does not foreclose it.

### The sync path

Source of truth is the website. It writes changes to an outbox and pushes them; each app
exposes a `registry-sync` edge function that applies them.

**Implemented** in `basic website/lib/webhooks/` — `registry-sync.ts` (sender, tombstones,
reconcile) on top of the shared hardened outbox in `outbox.ts`, driven by
`/api/cron/registry`. Receiver contract and ops runbook: `basic website/docs/webhooks.md`.

- **Transport:** the website POSTs to `https://<app-ref>.supabase.co/functions/v1/registry-sync`.
- **Auth:** an HMAC signature over the raw body using a per-app shared secret
  (`REGISTRY_SYNC_SECRET`), plus a timestamp header, rejected outside a 5-minute window
  to kill replays. **The website never holds an app's service-role key** — five
  service-role keys sitting in one app's env is exactly the credential-blast-radius the
  split exists to avoid. The edge function uses its own project's service role, which
  never leaves that project.
- **Idempotency:** every event carries `event_id` (text — the sender builds it as
  `registry.client:<client-uuid>:<version>`, so the same version cannot be queued
  twice; it is deliberately not a bare uuid) and `version` (monotonic per
  client). The function upserts only when `version > rsg_clients.version`, and records
  `event_id` in `rsg_registry_events` so a retry is a no-op. Out-of-order delivery
  settles correctly without coordination.
- **Retries:** exponential backoff with jitter on 5xx/timeout, giving up into a dead
  letter after 6 attempts. 4xx is not retried — it means the payload is wrong, and
  retrying a malformed payload forever just hides the bug.
- **Reconcile:** a nightly full sweep compares client id + version per app and repairs
  drift. Push handles latency; the sweep handles the events that were dropped while an
  app project was paused. **Do not rely on push alone** — a paused free-tier project
  silently 5xx's for days.
- **Deletion:** a client deleted upstream syncs as a tombstone (`deleted_at` set), never
  a hard delete, because app rows reference it. Purge is a separate, deliberate job.

### What syncs, and what deliberately does not

Only what an app genuinely needs to identify and bill a client: `id`, `name`, `status`,
`version`. **Not** contact details, notes, call transcripts, or anything from the
`rsg_*` CRM subsystem. Five copies of a client's phone number in five databases is five
places to leak it and five places to honour a deletion request.

### The ability profile is not part of this

`rsg.ability.v1` (CONTRACTS.md, Contract 1) describes a person's motor function. It is
the most sensitive data in the portfolio and it is the one thing every app reads.

It lives in **`rsg-onehand` only**. Other apps do not get a mirror. An app receives a
profile when the person explicitly grants it, per app, and the grant is recorded in
`onehand_profile_grants` with a timestamp and revocable at any time. Apps fetch it live
through a `profile-read` edge function that checks the grant on every call — so
revocation takes effect immediately instead of after the next sync.

This is strictly better than the status quo, where the profile sits in a localStorage key
that any app on the shared origin can read, and better than mirroring it five ways. The
split is what makes per-app consent possible; take the benefit.

Fallback behaviour is unchanged and mandatory: **missing profile → each app falls back to
its own defaults.** A person who declines the grant gets a working app, not a broken one.

---

## 3. What crosses a project boundary

With one database these were joins. Now they are calls. There are exactly three:

1. **Registry sync** (§2) — website → apps, push + nightly reconcile.
2. **Ability profile read** — apps → `rsg-onehand`, live, grant-checked.
3. **AI usage rollup** — apps → website, for billing. Each app meters locally in its own
   `ai_usage` table (the cap must be enforceable without a network hop, or the cap fails
   open when the website is down). A nightly job pulls per-client totals into the
   website for invoicing. Billing tolerates a day of latency; a spend cap does not.

Everything else stays inside one project. If a fourth crossing appears, that is a signal
the boundary is drawn wrong — revisit it rather than adding another sync.

---

## 4. AI key custody

The known gap: the Anthropic key currently sits in `localStorage` and is read by the
browser, so any XSS on the shared origin exfiltrates it (CONTRACTS.md, Contract 2).

Each app project gets an **`ai` edge function**. The key lives in that project's Supabase
secrets, never in a browser. The function:

- requires a valid app JWT (so anonymous callers cannot spend the key),
- checks the caller's month-to-date spend against their cap **before** calling Anthropic,
- records tokens and cost to `ai_usage` after,
- returns the model's response as a single JSON body. **It does not stream** —
  the handler accepts a `stream` flag and ignores it. No app streams today
  (`claude-bridge.js` is request/response), so nothing is broken by this, but do
  not read the flag as working support.

Two limits of the cap worth stating plainly, because "capped" reads stronger than
what is implemented: it is a **pre-check, not a reservation**. A single request
made while $0.01 remains still runs to completion at whatever it costs, and
concurrent requests all read the same remaining balance before any of them
record usage. It stops sustained overspend, not a burst.

This ports `basic website/lib/ai/proxy` and `lib/ai/usage` — that work is **not wasted**,
it moves. `lib/apps/context.ts` and `docs/app-mount-pattern.md` are the parts this
decision retires; see §6.

Per-app model choice stays per-app (Fable 5 / Haiku 4.5 / Opus 4.8), as it is today.

---

## 5. Create-project runbook

Blocked until Supabase **dashboard access is restored** — connected tooling can still
read the existing project, but creating projects and setting secrets needs the dashboard
or a CLI login. Everything in this repo is written and ready; these are the steps.

For each app in `ghost`, `nexus`, `observatory`, `forge`, `onehand`:

```bash
supabase projects create rsg-<app> --org-id hauyxdkkeycbzoyizrdz --region us-east-2
```

Then, from that app's folder:

```bash
supabase link --project-ref <new-ref>
supabase db push
supabase functions deploy ai registry-sync
supabase secrets set ANTHROPIC_API_KEY=<key> REGISTRY_SYNC_SECRET=<generated>
```

Generate a distinct `REGISTRY_SYNC_SECRET` per app — one shared secret across five
projects means one leak compromises all five. Record each app's ref and anon key in that
app's `.env` (see `.env.example`), and the five secrets in the website's env as
`REGISTRY_SYNC_SECRET_<APP>`.

**Verify before calling an app done** (per `app-mount-pattern.md` §5, which was right
about this): sign in as user A, create data, refresh — it persists. Sign in as user B —
B sees none of A's data and A sees none of B's. With RLS this is a database test, so
also run it with a raw anon-key query outside the app UI, where the app's own filtering
cannot make a broken policy look correct.

---

## 6. What this retires

- `basic website/docs/app-mount-pattern.md` — superseded. Its §5 acceptance test is kept
  above; the rest describes a topology no longer being built.
- `basic website/lib/apps/context.ts` — the `requireAppApi`/`requireAppPage` helper has
  no consumers now. Leave it until the first app ships, then delete it.
- `basic website/lib/ai/proxy` + `lib/ai/usage` — **not** retired. Ported to the per-app
  edge function (§4); the website keeps its own copy for its own AI features.
- The `ai_usage` migration in the website DB stays — it now holds the rolled-up totals
  from §3.3 rather than live per-call rows.
