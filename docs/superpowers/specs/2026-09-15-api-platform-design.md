# API Platform — design

**Date:** 2026-09-15
**Scope:** `Website/` (the live Next.js site). Adds a versioned public API
(`/api/v1`), API keys for clients and admins, keyless public endpoints,
outbound webhooks, usage logging, key-management UI, an OpenAPI spec, and a
`/developers` docs page. Also fills concrete gaps in existing cookie-auth
routes that the API surfaced.

## 0. Goals and decisions already made

- Three auth modes from day one: **client keys** (scoped to one client's
  data), **admin keys** (bounded by the creating admin's permissions), and
  **public** (no key, IP rate-limited).
- Client v1 exposes projects/milestones/tasks/approvals, tickets, briefs,
  files (download only), billing (read only).
- Admin v1 exposes leads (read/write), clients + proposals (read), dashboard
  entities (actions/opportunities/risks/ideas), audit + analytics export.
- Public v1 exposes booking services/slots/create, industries + plans, lead
  submit, status.
- Features: outbound webhooks, usage logs + key-management UI, idempotency
  keys + cursor pagination + uniform error envelope.
- Approach: a **new `/api/v1` route tree** behind a single `withApi()`
  wrapper. Existing cookie routes are untouched except for the gap fills in
  §3.4. (Alternatives rejected: retrofitting bearer auth onto existing
  RPC-style routes; a separate service.)
- Delivered in four phases (§7), each with its own implementation plan.

## 1. Auth and API keys

### 1.1 Schema

Migration `Website/supabase/migrations/<ts>_api_platform.sql` (one file for
all phases):

```sql
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  principal_type text not null check (principal_type in ('client','admin')),
  principal_id uuid not null,
  name text not null,
  key_prefix text not null,            -- "rsg_live_a1b2c3d4", shown in UI
  key_hash text not null unique,       -- sha256(full key), hex
  scopes text[] not null,
  created_by text not null,            -- creator email
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index api_keys_principal_idx on public.api_keys (principal_type, principal_id)
  where revoked_at is null;
alter table public.api_keys enable row level security;   -- service role only
```

Plus `api_idempotency` (§2.5), `api_requests` (§2.8), and the
`webhook_endpoints` column adds (§4.1).

### 1.2 Key format and lookup

- Plaintext: `rsg_live_` + 32 base62 chars from `crypto.randomBytes`.
  Returned exactly once on create; never stored.
- `key_prefix` = first 8 chars after `rsg_live_`.
- Resolve: sha256 the presented bearer → single indexed select on
  `key_hash`. Reject if `revoked_at` set, `expires_at` past, or the
  principal is gone/inactive (client status not active; admin row
  inactive). Bump `last_used_at` at most once per 60 s per key (in-memory
  throttle; a miss just means a slightly stale timestamp).

### 1.3 Principals

- **Client key** → synthetic `PortalContext` (`lib/lifecycle/access`
  shape): `client` = the client row; `user = { id: key.id, name: key.name,
  email: client.email, role: "api", isLegacyOwner: false }`. Approve/decide
  rights exist iff scope `projects:write` is present. Every query is scoped
  by `client.id` — same choke point as the portal.
- **Admin key** → `ApiAdminPrincipal { adminId, email, permissions }` where
  `permissions` is the creating admin's permission set re-read at resolve
  time (not snapshotted), so a demoted or deactivated admin's keys lose
  rights immediately. Effective scopes = `key.scopes ∩ scopes allowed by
  permissions`.

### 1.4 Scope vocabulary

Client: `projects:read` `projects:write` `tickets:read` `tickets:write`
`briefs:read` `briefs:write` `files:read` `billing:read` `webhooks:manage`.

Admin: `leads:read` `leads:write` `clients:read` `proposals:read`
`dashboard:read` `dashboard:write` `audit:read` `analytics:read`
`webhooks:manage`.

Admin scope → required permission (`lib/api/scopes.ts`):

| scope | permission |
|---|---|
| `leads:read`, `leads:write` | `manage_leads` |
| `clients:read` | `manage_clients` |
| `proposals:read` | `manage_clients` |
| `dashboard:read`, `dashboard:write` | `manage_leads` (matches the current entities route) |
| `audit:read` | `view_audit` |
| `analytics:read` | `view_analytics` |
| `webhooks:manage` | any admin |

A key cannot be created with a scope the creator lacks (422).

### 1.5 Key management (cookie-auth, CSRF-protected, not under `/api/v1`)

- Portal: `GET/POST /api/portal/apikeys`, `DELETE /api/portal/apikeys/[id]`.
  Portal roles owner/admin only. Max 10 active keys per client.
- Admin: `GET/POST /api/admin/apikeys`, `DELETE /api/admin/apikeys/[id]`.
  Any admin may create keys bounded by their own permissions; admins with
  `manage_team` list/revoke all keys, others only their own.
- UI: "API keys" card in portal settings; `/admin/api-keys` page. Create
  (name + scope checkboxes → one-time plaintext modal with copy button),
  list (prefix, scopes, last used, 30-day request count from
  `api_requests`), revoke (confirm dialog). Uses `components/ui`
  primitives.
- Audit events: `apikey.create`, `apikey.revoke` via `writeAuditEvent`
  (portal actions also `logClientActivity`).

## 2. Request pipeline (`Website/lib/api/`)

### 2.1 `withApi(config, handler)`

Wraps every export in `app/api/v1/**/route.ts`.

```ts
type ApiConfig = {
  auth: "client" | "admin" | "none";
  scopes?: string[];            // all required
  idempotent?: boolean;         // requires Idempotency-Key on this write
  rateLimit?: { limit: number; windowMs: number };
  body?: ZodType; query?: ZodType;
  meta: { operationId: string; summary: string; tag: string; response: ZodType };
};
```

Order: correlation id + timer → auth → scopes → rate limit → idempotency →
validation → handler → usage log. Handlers receive
`{ principal, body, query, params, request }` and return a plain object
(`{ data, meta? }`) or throw `ApiError(status, code, message, details?)`.

### 2.2 Auth

`Authorization: Bearer <key>`. Missing/invalid → 401 `unauthenticated`.
`auth:"none"` skips the requirement but still resolves a key if one is
sent, so public usage can be attributed. Wrong principal type for the route
(client key on an admin route) → 403 `insufficient_scope`.

### 2.3 Scopes

Missing any required scope → 403 `insufficient_scope`, `details.required`
lists them.

### 2.4 Rate limits

Existing `rateLimit()` (Upstash / memory fallback). Keys: `api:key:<id>`
default 600 requests / 10 min; keyless `api:ip:<ip>` default 60 / 10 min;
per-route overrides via `config.rateLimit`. 429 carries `Retry-After`.
Every v1 response carries `X-RateLimit-Limit` and `X-RateLimit-Remaining`
(from the limiter when available; omitted on memory fallback).

### 2.5 Idempotency

For `idempotent: true` routes the `Idempotency-Key` header is required
(8–200 chars) → else 400 `idempotency_required`.

```sql
create table public.api_idempotency (
  principal_id uuid not null,
  key text not null,
  request_hash text not null,          -- sha256(method + path + body)
  status text not null check (status in ('in_flight','done')),
  response_status int,
  response_body jsonb,
  created_at timestamptz not null default now(),
  primary key (principal_id, key)
);
```

Flow: insert `in_flight` (conflict → read row: `done` + same hash → replay
with header `Idempotent-Replayed: true`; `done` + different hash → 422
`idempotency_mismatch`; `in_flight` → 409 `conflict`). After the handler,
update to `done` with the response. Rows older than 24 h are deleted by the
cron cleanup (§7). Keyless public writes use `ip` as the principal id
namespace (`00000000-…` + ip hashed into a uuid v5).

### 2.6 Validation

`config.body` / `config.query` are zod schemas; failure → 422
`validation_failed` with `details = error.flatten()`. Query params not in
the schema are ignored, never forwarded to the DB.

### 2.7 Envelope and conventions

- Success: `{ data }`; lists: `{ data: [...], meta: { next_cursor: string|null, limit } }`.
- Error: `{ error: { code, message, details?, correlation_id } }`.
- Codes: `unauthenticated`, `insufficient_scope`, `not_found`,
  `validation_failed`, `rate_limited`, `idempotency_required`,
  `idempotency_mismatch`, `conflict`, `unavailable`, `internal`.
- Pagination: `?limit=` (1–100, default 25), `?cursor=` opaque base64url of
  `[created_at, id]`. Helper `paginate()` in `lib/api/pagination.ts`;
  ordering is `(created_at desc, id desc)` everywhere.
- Filters are whitelisted per resource (`status`, `since`, `until`, `q`,
  `project_id`).
- IDs are UUIDs; timestamps ISO-8601 UTC; money is integer cents +
  `currency`.
- Responses are explicit DTOs from `lib/api/serializers.ts`; never raw rows.
  A denylist test (§6) guards `password_hash`, `configuration_encrypted`,
  `key_hash`, `secret`, `mfa_*`, `internal_notes`.

### 2.8 Usage log

```sql
create table public.api_requests (
  id bigint generated always as identity primary key,
  key_id uuid,                          -- null for keyless
  principal_type text, principal_id uuid,
  method text not null, path text not null, status int not null,
  duration_ms int not null, ip text, correlation_id text,
  created_at timestamptz not null default now()
);
create index api_requests_key_created_idx on public.api_requests (key_id, created_at desc);
```

Inserted fire-and-forget after the response is built (never awaited on the
response path; errors logged via `lib/observability`). Retained 30 days
(cron cleanup). Path is stored with dynamic segments as written in the
route template (`/v1/tickets/{id}`), not the concrete id.

### 2.9 Middleware and CORS

`middleware.ts`: requests whose pathname starts with `/api/v1/` skip the
bot-UA, fetch-metadata, Origin, and CSRF checks (bearer auth replaces them).
Everything else is unchanged. `withApi` adds CORS headers on v1 only:
`Access-Control-Allow-Origin: *`, `Allow-Methods: GET, POST, PATCH, DELETE,
OPTIONS`, `Allow-Headers: Authorization, Content-Type, Idempotency-Key`;
an `OPTIONS` export is generated by the wrapper.

### 2.10 Feature flag

`API_PLATFORM_ENABLED` env. Unset → every v1 route returns 503
`unavailable`, `/api/v1/openapi.json` and `/developers` 404, key-management
UI hidden. `lib/env.ts` exposes `apiPlatformEnabled()`.

## 3. Resources

All paths are under `/api/v1`. `[scope]` = required scope. Writes marked
*idem* require `Idempotency-Key`.

### 3.1 Client-scoped

| Method | Path | Notes |
|---|---|---|
| GET | `/me` | client `{ id, company, name, email, status }`, key `{ id, name, scopes }` |
| GET | `/projects` | `[projects:read]`; filter `status` |
| GET | `/projects/{id}` | project + milestones + tasks + open approvals; `progress`, `health` via `computeProgress/computeHealth` |
| POST | `/projects/{id}/milestones/{mid}/approve` | `[projects:write]` *idem*; `{ note? }` → `approveMilestone` |
| POST | `/projects/{id}/milestones/{mid}/request-changes` | `[projects:write]` *idem*; `{ note }` → `requestMilestoneChanges` |
| POST | `/projects/{id}/tasks/{tid}/complete` | `[projects:write]` *idem* → `updateTask` |
| POST | `/approvals/{id}/decide` | `[projects:write]` *idem*; `{ decision: approved\|changes_requested, note? }` → `decideApproval` |
| GET | `/tickets` | `[tickets:read]`; filter `status` |
| GET | `/tickets/{id}` | includes `messages[]` |
| POST | `/tickets` | `[tickets:write]` *idem*; `{ subject, body, priority?, category? }` → `createTicket` |
| POST | `/tickets/{id}/messages` | `[tickets:write]` *idem*; `{ body }` |
| POST | `/tickets/{id}/reopen`, `/tickets/{id}/confirm-close` | `[tickets:write]` *idem* |
| GET | `/briefs`, `/briefs/{id}` | `[briefs:read]` |
| POST | `/briefs` | `[briefs:write]` *idem*; `BriefPayloadSchema` → `ingestBrief(payload, key, "api")`, tagged with client id |
| GET | `/files`, `/files/{id}` | `[files:read]`; filter `project_id` |
| GET | `/files/{id}/download` | 302 to `getDownloadUrl` (short-lived signed URL) |
| GET | `/invoices`, `/invoices/{id}`, `/payments` | `[billing:read]` |
| GET | `/subscription` | managed-service plan status `[billing:read]` |

Ownership checks (milestone belongs to a project of this client, ticket
belongs to this client, etc.) return 404 `not_found`, never 403, so the
existence of other clients' records is not revealed.

### 3.2 Admin-scoped

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/leads` | `[leads:read]`; `status`, `since`, `q` (name/email/company, `escapeLikePattern`), cursor |
| GET | `/admin/leads/{id}` | |
| POST | `/admin/leads` | `[leads:write]` *idem*; `{ name, email, company?, phone?, message?, source?, industry? }` → `saveLead`; dedupes via `findRecentLeadByEmail` (returns existing with 200) |
| PATCH | `/admin/leads/{id}` | `[leads:write]`; `status`, `score`, `owner`, `notes` → `updateLead` |
| DELETE | `/admin/leads/{id}` | `[leads:write]`; soft delete (`deleted_at`; excluded from all lists) |
| GET | `/admin/leads/export` | `[leads:read]`; `text/csv` stream, same filters, no cursor, max 10 000 rows |
| GET | `/admin/clients`, `/admin/clients/{id}` | `[clients:read]`; `q`, `status` |
| GET | `/admin/proposals`, `/admin/proposals/{id}` | `[proposals:read]`; `status` |
| GET/POST | `/admin/{actions\|opportunities\|risks\|ideas}` | `[dashboard:read]` / `[dashboard:write]` *idem*; zod schemas moved from the entities route into `lib/dashboard/entity-schemas.ts` and shared |
| GET/PATCH | `/admin/{entity}/{id}` | |
| GET | `/admin/audit` | `[audit:read]`; `action`, `since`, cursor → `listAuditEvents` |
| GET | `/admin/analytics/pageviews` | `[analytics:read]`; `since`, `until`, cursor |

Admin writes also go through `writeAuditEvent` with `actorType: "api_key"`.

### 3.3 Public (no key)

| Method | Path | Notes |
|---|---|---|
| GET | `/public/booking/services` | `lib/scheduling/catalog` |
| GET | `/public/booking/slots?service=&date=` | `lib/scheduling/slots`; 120 / 10 min / IP |
| POST | `/public/booking` | *idem*; same schema as `/api/booking/create`; honeypot field; 10 / h / IP |
| GET | `/public/industries` | industries list (public fields only) |
| GET | `/public/plans` | managed-service plans + pricing tiers |
| POST | `/public/leads` | *idem*; `{ name, email, company?, message?, source? }` → `saveLead`; 5 / h / IP; 202 |
| GET | `/public/status` | `{ status, version, checks: { db, email } }` — readiness from `/api/health` minus internals |

### 3.4 Gap fills in existing cookie routes and libs

- `/api/admin/leads`: `GET` gains `q`, `status`, `limit`, `cursor`; add
  `POST` (create), `DELETE /[id]` (soft), `GET /export` (CSV). Admin leads
  page gets search + export button.
- `/api/admin/clients`: `GET` gains `q`, `status`, `limit`, `cursor`;
  `PATCH /[id]` accepts `status: "inactive"`.
- `lib/store`: `listLeads({ q, status, since, cursor, limit })`,
  `softDeleteLead(id)`, `listClients({ q, status, cursor, limit })`.
  `getLeads()` / `getClients()` remain for existing callers.
- `lib/lifecycle/*`: cursor-capable `listTicketsForClientPage`,
  `listFilesForPage`, `listInvoicesPage`, `listProjectsForClientPage`;
  existing non-paged functions untouched.
- `leads` table: add `deleted_at timestamptz` (in the same migration).

## 4. Webhooks

### 4.1 Schema additions

```sql
alter table public.webhook_endpoints
  add column owner_type text check (owner_type in ('client','admin')),
  add column owner_id uuid,
  add column events text[] not null default '{}',
  add column api_key_id uuid references public.api_keys(id) on delete set null,
  add column disabled_at timestamptz,
  add column failure_count int not null default 0;
create index webhook_endpoints_owner_idx on public.webhook_endpoints (owner_type, owner_id)
  where disabled_at is null;
```

`kind='registry'` rows keep null owner and are never matched by `emitEvent`.
`webhook_deliveries` is unchanged.

### 4.2 Event catalog (`lib/webhooks/events.ts`)

Single source of truth: `{ type, audience: "client"|"admin"|"both",
dataSchema: ZodType }`. Feeds emission, the management API's `events`
validation, and the OpenAPI `webhooks` section.

Client + admin: `project.updated`, `milestone.completed`,
`milestone.approved`, `milestone.changes_requested`, `task.completed`,
`approval.requested`, `approval.decided`, `ticket.created`,
`ticket.replied`, `ticket.resolved`, `brief.received`, `file.uploaded`,
`invoice.created`, `invoice.paid`.

Admin only: `lead.created`, `lead.updated`, `booking.created`,
`booking.cancelled`, `client.activated`, `proposal.accepted`,
`proposal.declined`. Plus `ping` (test).

Payload: `{ id, type, created_at, sequence, data }` where `data` is the same
DTO the REST API returns (client events include `client_id` for admin
receivers).

### 4.3 Emission

`emitEvent(type, data, { clientId? })` in `lib/webhooks/emit.ts`: select
enabled endpoints whose `events @> {type}` and whose owner may see it
(client endpoints: `owner_id = clientId`; admin endpoints: all), then call
the existing `enqueue()` with `event_id = ${type}:${entityId}:${version}`
(version = the entity's `updated_at` epoch or explicit counter) so
double-fires dedupe. Call sites live in the lib functions (`approveMilestone`,
`requestMilestoneChanges`, `updateTask`, `decideApproval`, `createTicket`,
ticket reply/resolve, `ingestBrief`, `createFileRecord`, `createInvoice`,
`handleStripeEvent` paid, `saveLead`, `updateLead`, booking create/cancel,
client activation, proposal accept/decline), never in route handlers, so
portal UI, admin UI, and API emit identically. Emission failures are logged
and never fail the caller. Delivery/retry/dead-letter is the existing cron
deliverer.

Auto-disable: on a `dead` delivery the endpoint's `failure_count`
increments; at 20 it sets `disabled_at`. A successful delivery resets it to 0.
`PATCH { enabled: true }` clears `disabled_at` and the counter.

### 4.4 Management API (`[webhooks:manage]`, both principal types)

| Method | Path | Notes |
|---|---|---|
| GET | `/webhooks` | endpoints owned by the principal |
| POST | `/webhooks` | *idem*; `{ url, events[], description? }` → endpoint + one-time `secret` |
| GET/PATCH/DELETE | `/webhooks/{id}` | PATCH `url`, `events`, `description`, `enabled` |
| POST | `/webhooks/{id}/rotate-secret` | returns new secret once |
| POST | `/webhooks/{id}/test` | enqueues `ping` |
| GET | `/webhooks/{id}/deliveries` | cursor list: `status`, `response_code`, `attempts`, `next_attempt_at`, `created_at` |
| POST | `/webhooks/{id}/deliveries/{did}/replay` | re-queues a `dead`/`failed` delivery |

URL rules: `https:` only (http allowed only when `NODE_ENV !== "production"`),
hostname must not be `localhost`, an IP literal in loopback / RFC1918 /
link-local / CGNAT ranges, or `.internal`/`.local`. Max 10 endpoints per
owner. Events must exist in the catalog and match the owner's audience.
Signing is unchanged (`x-rsg-signature`, `x-rsg-timestamp`, 5-min
tolerance, `${timestamp}.${body}`).

### 4.5 UI

"Webhooks" tab beside "API keys" in portal settings and `/admin/api-keys`:
list endpoints (url, events, status, last delivery), create/edit, recent
deliveries with status + replay button. Cookie routes
`/api/portal/webhooks[/…]` and `/api/admin/webhooks[/…]` are thin wrappers
over the same `lib/webhooks/endpoints.ts` functions the v1 routes use.

## 5. OpenAPI and developer docs

### 5.1 Spec

`lib/api/openapi.ts`. `withApi` registers each operation's `meta` into a
module-level registry; `buildOpenApi()` imports every
`app/api/v1/**/route.ts` (static import list generated by a small script
`scripts/gen-v1-index.ts`, checked in, asserted current by a test) and
emits OpenAPI 3.1 using zod v4's `z.toJSONSchema()`:

- `components.securitySchemes.bearerAuth`, per-operation `security` and
  `x-scopes`, `x-idempotent`.
- Shared components: error envelope, pagination params, `Idempotency-Key`
  header.
- `webhooks` section from the event catalog with the signature headers.
- `info.version` = `package.json` version.

Served at `GET /api/v1/openapi.json` (public, `Cache-Control: public,
max-age=3600`).

### 5.2 `/developers` page

Route group `(marketing)` so it inherits nav/footer/theme. Server-rendered
from `buildOpenApi()`; no third-party doc UI. Left rail: Getting started ·
Authentication · Errors · Pagination · Idempotency · Rate limits · Webhooks
· one section per tag. Per operation: method badge + path, scopes chip,
params table, request/response schema rendered from JSON Schema, and a
`curl` example built from schema `.example` values. Prose lives in
`content/developers/*.md`. "Download OpenAPI" link. Built with
`components/ui` primitives; `/developers` is added to the responsive audit
route list.

### 5.3 Guardrails (tests)

- Every `app/api/v1/**/route.ts` operation appears in the spec.
- Every example request validates against its own zod schema.
- Structural OpenAPI 3.1 assertions (required top-level keys, every path
  item has an operation with `operationId`, unique operationIds).

## 6. Testing

`node --test tests/*.test.ts`, stubbed Supabase client as in
`tests/booking-intake.test.ts`.

- `api-keys.test.ts`: generate/hash/resolve; revoked, expired,
  deactivated-creator, inactive client all reject; admin scope cap;
  `last_used_at` throttle.
- `api-pipeline.test.ts`: `withApi` matrix — missing/invalid bearer, wrong
  principal type, insufficient scope, 429 + headers, idempotency
  required/replayed/mismatch/in-flight, 422 envelope, `ApiError` mapping,
  usage log invoked and non-blocking, feature flag 503, CORS/OPTIONS.
- `api-pagination.test.ts`: cursor round-trip, limit clamp, stable order.
- `api-serializers.test.ts`: DTO denylist (§2.7).
- `api-routes.test.ts`: cross-client isolation (client A key → client B
  ticket = 404), admin filters + soft-deleted exclusion, public rate
  limits, CSV export header/rows.
- `webhooks-emit.test.ts`: fan-out by owner/audience/event, deterministic
  `event_id`, URL validation, auto-disable at 20, rotate secret.
- `openapi.test.ts`: §5.3 guardrails + generated index current.
- `middleware.test.ts`: `/api/v1/*` bypasses CSRF/bot checks; other
  mutating routes still require them.
- Pre-merge manual: `npm run typecheck && npm run lint && npm run build &&
  npm run audit:responsive` (routes: `/developers`, portal settings API
  tab, `/admin/api-keys`).

## 7. Rollout

Branch `feat/api-platform` off `main`; one PR per phase.

1. **Core + client API**: migration (all tables/columns), `lib/api/*`,
   middleware exemption, feature flag, key management (routes + UI, both
   principal types), client resources (§3.1), paged lib functions.
2. **Admin + public + gap fills**: §3.2, §3.3, §3.4, dashboard schema
   extraction, admin leads page search/export.
3. **Webhooks**: §4 end to end, including UI tabs.
4. **Docs**: §5, plus `/developers` in the responsive audit.

Cron: extend `/api/cron/scheduling` with `api_idempotency` (>24 h) and
`api_requests` (>30 d) cleanup; no new Vercel cron entry. The feature flag
stays unset in production until Phase 2 ships; Phase 1 can be verified in
preview with the flag on.

## 8. Non-goals

OAuth / third-party app marketplace; per-key custom rate limits; sandbox
or test-mode keys; GraphQL; file upload via API; DNS-rebinding defense on
webhook delivery (URL is validated at registration only); generated SDKs;
key-management via the v1 API itself (keys are created in the UI only).
