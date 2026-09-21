# API Platform

External REST API under `/api/v1`, gated by a feature flag. Phase 1 covers
client self-service (projects, tickets, briefs, files, billing). Phase 2
adds staff/admin CRM endpoints and a small keyless public surface (booking,
lead capture, catalog reads). Spec:
[`docs/superpowers/specs/2026-09-15-api-platform-design.md`](superpowers/specs/2026-09-15-api-platform-design.md).

## What shipped

- Bearer-key auth (`rsg_live_<32 chars>`, hashed at rest) with scoped
  permissions, key issuance/revocation, and a max of 10 active keys per
  principal.
- Cursor pagination, idempotency for mutating requests, per-key usage
  logging, and rate limiting (Upstash Redis sliding window, with an
  in-memory sliding-window fallback for local/dev).
- Client-facing resources: `me`, `projects`, `tickets` (+ messages),
  `briefs`, `files` (+ download), `invoices`, `payments`, `subscription`,
  and milestone/task approval actions.
- Key management UI: portal **Developers** page for clients, admin **API
  keys** tab for staff/admin keys.
- Retention cron: expired idempotency rows (24h) and old request logs (30d)
  are purged on every `scheduling` cron tick (`lib/apiv1/cleanup.ts`).
- **Phase 2:** admin (bearer, staff-only) CRM endpoints for leads, clients,
  proposals, dashboard entities, audit, and pageview analytics; a keyless
  public surface for booking, lead capture, and catalog reads.
- **Phase 4:** a generated OpenAPI 3.1 document at `/api/v1/openapi.json`
  and a public reference page at `/developers` (see below).

## Enabling it

Two flags gate the platform; both must be `true`:

- `API_PLATFORM_ENABLED` — server-side gate. Routes return 503 `unavailable`
  when unset (same code as a backing-store outage; see Error codes below).
- `NEXT_PUBLIC_API_PLATFORM_ENABLED` — client-side gate for the portal
  Developers page / admin API keys tab.

Set both in Vercel **Preview** only for Phase 1; Production stays unset
until Phase 2 sign-off.

## Minting a key

- **Client**: Portal → Developers page → "Create key", choose scopes, copy
  the plaintext once (it is never shown again).
- **Admin/staff**: Admin dashboard → API keys tab → "Create key". Admin
  scopes are capped by the issuing admin's role.

## Quick start

```bash
curl https://<host>/api/v1/me \
  -H "Authorization: Bearer rsg_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

curl https://<host>/api/v1/tickets \
  -H "Authorization: Bearer rsg_live_..." \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: <uuid-or-random-string>" \
  -d '{"subject":"Question about invoice","body":"...","category":"bug"}'
```

`category` must be one of: `outage`, `bug`, `access`, `integration`,
`automation`, `data_reporting`, `website_update`, `training`, `feature`,
`billing`, `security` (defaults to `bug` if omitted).

## Admin endpoints (Phase 2)

Staff/admin bearer keys only (`principal.type === "admin"`; a client key
gets `insufficient_scope` 403 on every route below). Minted from the admin
dashboard's API keys tab, capped by the issuing admin's role. Standard
keyed rate limit (600 / 10 min) and pagination apply unless noted.

| Endpoint | Scope | Notes |
| --- | --- | --- |
| `GET /admin/leads` | `leads:read` | `?status=`, `?since=`, `?q=` (search), cursor pagination |
| `POST /admin/leads` | `leads:write` | Idempotent. 201, or 200 if `processLead` dedupes |
| `GET /admin/leads/{id}` | `leads:read` | |
| `PATCH /admin/leads/{id}` | `leads:write` | `status`/`notes`/`owner`/`archived_at`, at least one field |
| `DELETE /admin/leads/{id}` | `leads:write` | Soft delete |
| `GET /admin/leads/export` | `leads:read` | **10 / 10 min** (not the standard 600); same filters as list, no pagination |
| `GET /admin/clients` | `clients:read` | |
| `GET /admin/clients/{id}` | `clients:read` | |
| `GET /admin/proposals` | `proposals:read` | |
| `GET /admin/proposals/{id}` | `proposals:read` | |
| `GET /admin/{entity}` | `dashboard:read` | `entity` is one of `actions`, `opportunities`, `risks`, `ideas`; unknown entity is `not_found` 404, not 400 |
| `POST /admin/{entity}` | `dashboard:write` | Idempotent. Body schema is per-entity, validated in the handler |
| `GET /admin/{entity}/{id}` | `dashboard:read` | |
| `PATCH /admin/{entity}/{id}` | `dashboard:write` | Per-entity patch schema |
| `GET /admin/audit` | `audit:read` | `?action=`, `?since=` |
| `GET /admin/analytics/pageviews` | `analytics:read` | `?since=`, `?until=`; reads a local JSON file (`getPageViews()`, `lib/store.ts`) that is never written on Vercel, so it returns `[]` in production |

**CSV export:** `GET /admin/leads/export` returns raw `text/csv` (with
`Content-Disposition: attachment`), **not** the `{ data, meta }` JSON
envelope every other endpoint uses — parse it as CSV, not JSON.

## Public endpoints (Phase 2)

No API key required (`auth: "none"`). All keyless traffic still shares the
default 60 / 10 min IP rate limit unless a route sets its own (below).

| Endpoint | Rate limit | Notes |
| --- | --- | --- |
| `GET /public/status` | default | Health check; `checks.database` is `ok`/`unconfigured`/`unreachable`; 503 when `unreachable` |
| `GET /public/plans` | 120 / 10 min | Active managed-service plans |
| `GET /public/industries` | 120 / 10 min | Published industry verticals only |
| `GET /public/booking/services` | 120 / 10 min | Active services + public appointment types |
| `GET /public/booking/slots` | 120 / 10 min | `?appointment_type_id=` (uuid, required), `?from=`/`?to=` (max 31-day window), `?timezone=` |
| `POST /public/booking` | **10 / hour** | Idempotent. Creates a session + booking in one call; see captcha and idempotency notes below |
| `POST /public/leads` | **5 / hour** | Idempotent. Always 202; see honeypot note below |

**Captcha gate — both env vars must be set together.** `POST
/public/booking` verifies a Turnstile token only when
`isTurnstileConfigured()` is true, which requires BOTH
`TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to be set. If
only one is set, `isTurnstileConfigured()` reports the gate as inactive
(not silently active-but-passing) and the endpoint proceeds without a
captcha check, same as local/dev with neither var set. Set both to enforce
the gate.

**Booking idempotency is namespaced per caller IP.** `Idempotency-Key` on
`POST /public/booking` is rewritten to `pub:<ip-derived-id>:<key>` before
it reaches the shared booking dedupe (a global lookup by key, otherwise
guessable). Two callers behind the same NAT/proxy share that namespace, so
a key one of them used is unavailable to the other until it expires (24h) —
pick unique keys, not shared conventions like `"1"`. This isolation
boundary trusts `clientIp()` (`lib/security.ts`), which reads
`x-real-ip`/the rightmost `x-forwarded-for` hop — correct behind Vercel's
trusted proxy, but spoofable by any caller reaching the route directly.

**Honeypot field.** `POST /public/leads` accepts an undocumented
`website_url` field. A real visitor never sees or fills it (it's a hidden
form field for bot traps); if it arrives non-empty, the endpoint still
replies `202 { "accepted": true }` but silently drops the submission —
no lead is created. Integrators building their own form against this
endpoint should simply never send `website_url`.

## Webhooks (Phase 3)

Outbound webhooks ride the existing outbox (`lib/webhooks/outbox.ts`):
signed POSTs, exponential backoff with jitter, dead-lettering after 8
attempts, at-least-once delivery. **Receivers must dedupe on `id`** and
verify the signature — the wire format, signature scheme and retry rules
are documented in [webhooks.md](webhooks.md); this section covers what
Phase 3 adds on top.

### Endpoints are owned

Every endpoint belongs to the principal that created it: a client key
manages its client's endpoints, an admin key the admin's own. Each owner may
have at most **10** endpoints. An endpoint subscribes to an explicit list of
events; a client endpoint only ever receives events about its own client,
an admin endpoint receives everything it subscribes to (with `client_id` in
`data` for client events).

Delivery never follows redirects: a `3xx` from the endpoint is dead-lettered
rather than re-POSTed to a host the URL check never saw.

Rules for the URL: `https:` only in production (`http:` is accepted outside
it); no `localhost`, `.local`, `.internal`, loopback, RFC1918, link-local
(incl. the cloud metadata address), CGNAT or IPv6 ULA/link-local literals;
no credentials; ≤ 2048 chars. The check is DNS-free — a public hostname
that resolves to a private address at delivery time is not caught.
`WEBHOOK_URL_ALLOW_PRIVATE=1` lifts only the host block, only outside
production, for local delivery tests.

### Fan-out

One domain event produces one delivery row per eligible endpoint, all sharing
the same event `id`. Per-endpoint dedupe is the `(endpoint_id, event_id)`
unique index. Migration `20260921140000_webhook_deliveries_fanout.sql` drops
the older **global** unique index on `idempotency_key`; until it is applied, a
second endpoint subscribed to the same event silently gets nothing (its
insert collides and is skipped as a dedupe). Apply it before enabling the
platform in an environment with more than one endpoint.

`createWebhook` and `rotateWebhookSecret` are idempotent but their response
body (the `whsec_` secret) is never stored in `api_idempotency`; replaying
the same `Idempotency-Key` returns 409 `conflict`.

### Payload envelope

```json
{ "id": "ticket.created:<ticket-id>:<updated_at>", "type": "ticket.created",
  "sequence": 41, "created_at": "…", "data": { …the same DTO the REST API returns…, "client_id": "…" } }
```

`id` is deterministic (`<type>:<entity id>:<version>`), so a re-emitted
event collapses to one delivery per endpoint and receivers can dedupe.

### Event catalog

| Event | Audience | Fires from |
|---|---|---|
| `project.updated` | client + admin | `updateProject` |
| `milestone.completed` / `.approved` / `.changes_requested` | client + admin | milestone status changes, client approval |
| `task.completed` | client + admin | a client task set to `done` |
| `approval.requested` / `approval.decided` | client + admin | approvals |
| `ticket.created` / `.replied` (non-internal messages only) / `.resolved` | client + admin | support |
| `brief.received` | client + admin | client-API brief ingest |
| `file.uploaded` | client + admin | workspace uploads |
| `invoice.created` / `invoice.paid` | client + admin | billing, Stripe checkout |
| `lead.created` / `lead.updated` | admin | any lead capture / admin edit |
| `booking.created` / `.rescheduled` / `.cancelled` | admin | scheduling |
| `client.activated` | admin | client provisioning |
| `proposal.accepted` / `proposal.declined` | admin | proposal approval / revision request |
| `ping` | both | the endpoint's **Test** action |

`GET /api/v1/webhooks/events` returns the list for the caller's audience.

### Management API (`webhooks:manage`, client or admin key)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/webhooks` | your endpoints (never the secret) |
| POST | `/api/v1/webhooks` | `{ url, events[], description? }` → 201 with `secret` — **shown once** |
| GET / PATCH / DELETE | `/api/v1/webhooks/{id}` | PATCH `url`, `events`, `description`, `enabled`; deleting cascades its deliveries |
| POST | `/api/v1/webhooks/{id}/rotate-secret` | new `secret`, shown once; old signatures stop verifying immediately |
| POST | `/api/v1/webhooks/{id}/test` | 202; queues a `ping` regardless of subscriptions |
| GET | `/api/v1/webhooks/{id}/deliveries` | cursor-paged; `?status=` filter; never includes the payload |
| POST | `/api/v1/webhooks/{id}/deliveries/{did}/replay` | re-queues a `failed` or `dead` delivery |
| GET | `/api/v1/webhooks/events` | catalog for your audience |

Writes are idempotent (`Idempotency-Key` required). The same actions are
available in the portal's Developers page and the admin console's API keys
→ Webhooks tab.

### Health

After **20** consecutive dead-lettered deliveries an endpoint is
auto-disabled (`disabled_at` set, `enabled` false); a successful delivery
resets the counter. `PATCH { "enabled": true }` re-enables it and clears the
counter. Delivery runs on the scheduling cron (`/api/cron/scheduling`), so
events reach receivers on its cadence, not instantly.

## OpenAPI & reference (Phase 4)

`GET /api/v1/openapi.json` serves an OpenAPI 3.1 document (keyless, cached
1h, 404 while the flag is off). `/developers` renders it server-side as a
public reference page with prose sections (`lib/developers/content.ts`),
one block per operation, curl examples and a webhook-events section; it
also 404s while the flag is off and is added to the sitemap only when on.

The document is built by `lib/apiv1/openapi.ts` from two sources and
nothing else:

- **Routes.** `withApi()` stamps its registration (method, auth, scopes,
  idempotent, `body`/`query`/`response` zod schemas, `rateLimit`) on the
  handler it returns; `buildOpenApi()` imports every `app/api/v1/**/route.ts`
  via the generated index `lib/apiv1/openapi-routes.ts` and reads them back
  with `operationOf()`. Paths come from the file location
  (`tickets/[id]` → `/api/v1/tickets/{id}`).
- **Webhooks.** `EVENT_TYPES`/`EVENTS` in `lib/webhooks/events.ts` become the
  OpenAPI `webhooks` map, with the signing headers documented.

To add an operation that documents itself: give `meta` a real `response`
schema from `lib/apiv1/response-schemas.ts` (`envelope(X)` /
`listEnvelope(X)`; `z.any()` fails CI), put `.meta({ example })` on the
request body schema if the route takes one, and if it is a new file run
`npm run gen:v1-index` and commit `lib/apiv1/openapi-routes.ts`.

Guardrails (`tests/apiv1-openapi-*.test.ts`, `tests/apiv1-response-schemas.test.ts`):
the index matches the filesystem; every handler export is a `withApi`
operation with a non-`any` response and a unique `operationId`; every
operation appears in the document under its path; every `$ref` resolves;
every request example validates against the zod schema it is declared on;
every DTO schema names exactly the keys its serializer emits.

## Error codes

Errors are `{ "error": { "code", "message", "details?", "correlation_id" } }`.

| Code | HTTP | Meaning |
| --- | --- | --- |
| `unauthenticated` | 401 | Missing/invalid/revoked key |
| `insufficient_scope` | 403 | Key lacks the required scope |
| `not_found` | 404 | Resource missing, or not owned by the caller |
| `validation_failed` | 422 | Request body/query failed validation |
| `rate_limited` | 429 | Too many requests in the current window |
| `idempotency_required` | 400 | Mutating request missing (or malformed) `Idempotency-Key` |
| `idempotency_mismatch` | 422 | Same key, different request body |
| `conflict` | 409 | State conflict (e.g. milestone not under review, max active keys) or a request with this `Idempotency-Key` still in flight |
| `unavailable` | 503 | Platform flag is off, or backing store unreachable |
| `internal` | 500 | Unexpected error |

## Pagination

List endpoints accept `?limit=` (default 25, max 100) and `?cursor=`
(opaque, base64url-encoded `created_at`/`id`). Responses include
`meta.next_cursor`, `null` when there is no further page.

## Idempotency

Every route marked idempotent (all Phase 1 `POST` routes, plus Phase 2's
`POST /admin/leads`, `POST /admin/{entity}`, `POST /public/booking`, and
`POST /public/leads`; there are no idempotent `PATCH`/`PUT`/`DELETE`
routes) requires an `Idempotency-Key` header, 8–200 characters. A missing or
out-of-range key returns `idempotency_required` (400). The pipeline hashes
method + path + body; a replayed request with the same key and body
returns the original response with `Idempotent-Replayed: true`. The same
key with a different body returns `idempotency_mismatch` (422). A second
request reusing a key that is still being processed returns `conflict`
(409). Idempotency rows expire after 24h.

## Rate limits

Default: keyed requests 600 / 10 minutes, keyless (unauthenticated)
requests 60 / 10 minutes. Several Phase 2 routes override the default with
a tighter, endpoint-specific limit (see the Admin/Public endpoint tables
above — e.g. `leads/export` 10 / 10 min, public booking 10 / hour, public
leads 5 / hour). Over the limit returns `rate_limited` (429) with a
`Retry-After: 60` header.

**Known deviation:** `X-RateLimit-Limit`/`X-RateLimit-Remaining` response
headers are not populated (`lib/security.rateLimit()` returns only a
boolean, not remaining counts) and are not advertised in the CORS
`Access-Control-Expose-Headers` list. Still outstanding as of Phase 2.

## Usage and cleanup

Every request is logged to `api_requests` (used for the `requests_30d`
count shown per key). The `scheduling` cron (`app/api/cron/scheduling/route.ts`)
calls `cleanupApiTables` on each tick to delete expired `api_idempotency`
rows (>24h) and `api_requests` rows (>30d); failures are captured in the
cron's JSON summary under `apiCleanup` rather than failing the run.
