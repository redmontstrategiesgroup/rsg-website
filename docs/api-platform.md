# API Platform — Phase 1

External REST API under `/api/v1`, gated by a feature flag. Covers client
self-service (projects, tickets, briefs, files, billing) and reads. Spec:
[`docs/superpowers/specs/2026-09-15-api-platform-design.md`](superpowers/specs/2026-09-15-api-platform-design.md).

## What shipped

- Bearer-key auth (`rsg_live_<32 chars>`, hashed at rest) with scoped
  permissions, key issuance/revocation, and a max of 10 active keys per
  principal.
- Cursor pagination, idempotency for mutating requests, per-key usage
  logging, and rate limiting (in-memory token bucket).
- Client-facing resources: `me`, `projects`, `tickets` (+ messages),
  `briefs`, `files` (+ download), `invoices`, `payments`, `subscription`,
  and milestone/task approval actions.
- Key management UI: portal **Developers** page for clients, admin **API
  keys** tab for staff/admin keys.
- Retention cron: expired idempotency rows (24h) and old request logs (30d)
  are purged on every `scheduling` cron tick (`lib/apiv1/cleanup.ts`).

## Enabling it

Two flags gate the platform; both must be `true`:

- `API_PLATFORM_ENABLED` — server-side gate. Routes return 404 when unset.
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
  -d '{"subject":"Question about invoice","body":"...","category":"billing"}'
```

## Error codes

Errors are `{ "error": { "code", "message", "details?", "correlation_id" } }`.

| Code | HTTP | Meaning |
| --- | --- | --- |
| `unauthenticated` | 401 | Missing/invalid/revoked key |
| `insufficient_scope` | 403 | Key lacks the required scope |
| `not_found` | 404 | Resource missing, or not owned by the caller |
| `validation_failed` | 422 | Request body/query failed validation |
| `rate_limited` | 429 | Too many requests in the current window |
| `idempotency_required` | 400 | Mutating request missing `Idempotency-Key` |
| `idempotency_mismatch` | 409 | Same key, different request body |
| `conflict` | 409 | State conflict (e.g. max active keys) |
| `unavailable` | 503 | Backing store unreachable |
| `internal` | 500 | Unexpected error |

## Pagination

List endpoints accept `?limit=` (default 25, max 100) and `?cursor=`
(opaque, base64url-encoded `created_at`/`id`). Responses include
`meta.next_cursor`, `null` when there is no further page.

## Idempotency

All mutating requests (`POST`/`PATCH`/`PUT`/`DELETE`) require an
`Idempotency-Key` header. The pipeline hashes method + path + body; a
replayed request with the same key and body returns the original response
with `Idempotent-Replayed: true`. The same key with a different body
returns `idempotency_mismatch` (409). Idempotency rows expire after 24h.

## Rate limits

Keyed requests: 600 requests / 10 minutes. Keyless (unauthenticated)
requests: 60 requests / 10 minutes. Over the limit returns `rate_limited`
(429).

**Known deviation:** `X-RateLimit-Limit`/`X-RateLimit-Remaining` response
headers are not yet populated (the CORS `Access-Control-Expose-Headers`
list reserves the names, but the pipeline does not set them). Deferred to
Phase 2.

## Usage and cleanup

Every request is logged to `api_requests` (used for the `requests_30d`
count shown per key). The `scheduling` cron (`app/api/cron/scheduling/route.ts`)
calls `cleanupApiTables` on each tick to delete expired `api_idempotency`
rows (>24h) and `api_requests` rows (>30d); failures are captured in the
cron's JSON summary under `apiCleanup` rather than failing the run.
