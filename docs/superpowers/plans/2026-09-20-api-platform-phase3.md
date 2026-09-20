# API Platform — Phase 3 Implementation Plan (Webhooks)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship outbound webhooks on the existing outbox: owned endpoints with event subscriptions, a single event catalog, `emitEvent()` called from the lib functions so portal, admin console and API all emit identically, a management API under `/api/v1/webhooks`, and Webhooks tabs in the portal and admin UIs.

**Architecture:** No second sender. `lib/webhooks/outbox.ts` (`enqueue` → cron `deliverPendingWebhooks` → signed POST with retries/dead-letter) already exists; Phase 3 adds ownership + subscription filtering IN FRONT of it (`lib/webhooks/emit.ts` resolves eligible endpoints per owner/event and passes explicit `endpointIds` to `enqueue`), an endpoint store (`lib/webhooks/endpoints.ts`, injected Supabase client, test-importable), an SSRF-safe URL check, a catalog (`lib/webhooks/events.ts`, zod data schemas, also feeds Phase 4's OpenAPI), and thin v1 handlers + cookie routes over the store. Auto-disable after 20 consecutive dead letters is a small hook in the deliverer.

**Tech Stack:** Next.js 15 route handlers, zod 4, Supabase service-role client, `node --test` with fake builders and `mock.module` (already enabled in `npm test`).

**Spec:** `docs/superpowers/specs/2026-09-15-api-platform-design.md` §4 (4.1 schema — already applied in Phase 1's migration, 4.2 catalog, 4.3 emission, 4.4 management API, 4.5 UI). Phases 1–2 are on this branch; read `docs/api-platform.md`, `lib/webhooks/outbox.ts`, `lib/webhooks/sign.ts` and `lib/apiv1/pipeline.ts` before starting.

## Global Constraints

- Work on `feat/api-platform` in the existing worktree `Website/.claude/worktrees/api-platform` (HEAD ≥ `34aac31`). Run every command from there.
- **No new migration.** Phase 1's `20260915120000_api_platform.sql` already added `owner_type`, `owner_id`, `api_key_id`, `disabled_at`, `failure_count` and the owner index to `webhook_endpoints`. **`webhook_endpoints.events` is `jsonb` (`'[]'::jsonb`, from `20260714180000_scheduling_platform.sql`), NOT `text[]`** — the Phase 1 `add column if not exists` was a no-op on it. Read/write it as a JSON array of strings; never use PostgREST array operators on it. Subscription filtering happens in JS over the owner's (≤10) endpoints.
- Existing outbox contract (do not break): `enqueue({ eventType, eventId?, payload, kind?, endpointIds? })` never throws; dedupes on `(endpoint_id, event_id)`; wraps payload as `{ id, type, sequence, created_at, data }`; signs with `x-rsg-signature` / `x-rsg-timestamp` over `${timestamp}.${body}` (`lib/webhooks/sign.ts`). Registry-sync endpoints (`kind = 'registry'`, null owner) must never be matched by emission or management.
- Conventions inherited from Phases 1–2: inside `lib/apiv1/` and `lib/webhooks/{events,url-check,endpoints}.ts`, relative imports with `.ts` extensions, no `@/`, no enums / parameter properties / namespaces, no `any`. Resource modules under `lib/apiv1/resources/`, `lib/webhooks/emit.ts`, route files and lifecycle modules may use `@/`. Every v1 route file: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `api(method, config, handler)`, `OPTIONS = options`, `response: z.any()`. Path ids → `requireUuid`. Not-owned/missing → 404 `not_found`. Writes `idempotent: true`.
- Scope `webhooks:manage` exists for BOTH principal types (`lib/apiv1/scopes.ts`). Owner of an endpoint = the principal: client key → `{ owner_type: "client", owner_id: portal.client.id }`; admin key → `{ owner_type: "admin", owner_id: adminId }`. Max **10** endpoints per owner.
- URL rules (§4.4): `https:` only (`http:` allowed only when `NODE_ENV !== "production"`); hostname must not be `localhost`, an IP literal in loopback / RFC1918 / link-local / CGNAT / `0.0.0.0/8` / IPv6 loopback+ULA+link-local ranges, or end in `.internal` / `.local`; max 2048 chars.
- Emission never throws and never awaits delivery; failures are `console.error`'d. `event_id` is deterministic: `${type}:${entityId}:${version}`.
- Auto-disable: on a `dead` delivery increment `failure_count`; at **20** set `disabled_at`; a delivered event resets `failure_count` to 0; `PATCH { enabled: true }` clears `disabled_at` and resets the counter.
- Audit: v1 writes via `auditVia` (admin) — for client principals use `logClientActivity` (as the Phase 1 client routes do); actions `webhook.create` / `webhook.update` / `webhook.delete` / `webhook.rotate_secret` / `webhook.replay`.
- Commit trailer: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`; exact subjects as given. Per task: `npm run typecheck && npm run lint`; focused tests; full `npm test` before each commit.

---

## File map

| File | Responsibility |
|---|---|
| `lib/webhooks/events.ts` | catalog: `EVENT_TYPES`, `EventType`, `EVENTS` (audience + zod data schema), `isEventType`, `eventsFor(audience)` |
| `lib/webhooks/url-check.ts` | `checkWebhookUrl(url, opts)` → `{ ok: true, url } \| { ok: false, reason }` |
| `lib/webhooks/endpoints.ts` | store: `createEndpoint`, `listEndpoints`, `getOwnedEndpoint`, `updateEndpoint`, `deleteEndpoint`, `rotateSecret`, `listDeliveriesPage`, `replayDelivery`, `toEndpointDto`, `toDeliveryDto`, `MAX_ENDPOINTS` |
| `lib/webhooks/outbox.ts` (modify) | `EnqueueInput.skipSubscriptionFilter`; failure-count bump / auto-disable / reset in `attemptDelivery` |
| `lib/webhooks/emit.ts` | `emitEvent(type, data, { entityId, version, clientId? })`, `sendTestEvent(endpointId)` |
| `lib/lifecycle/{projects,workspace,support,files,billing}.ts`, `lib/briefs/ingest.ts`, `lib/store.ts`, `lib/scheduling/booking.ts`, `lib/lifecycle/access.ts`, `lib/lifecycle/proposals.ts` (modify) | emission call sites |
| `lib/apiv1/resources/webhooks.ts` + `app/api/v1/webhooks/**` | management API |
| `app/api/portal/webhooks/**`, `app/api/admin/webhooks/**` | cookie wrappers |
| `components/shared/WebhooksManager.tsx`, `app/portal/developers/page.tsx` (modify), `components/admin/ApiKeysAdminPanel.tsx` (modify) | UI |
| `tests/webhooks-{events,url-check,endpoints,emit,api}.test.ts` | tests |

---

### Task 1: Event catalog

**Files:**
- Create: `lib/webhooks/events.ts`
- Test: `tests/webhooks-events.test.ts`

**Interfaces:**
- Produces:
  - `EVENT_TYPES` (readonly tuple) in this exact order: `project.updated, milestone.completed, milestone.approved, milestone.changes_requested, task.completed, approval.requested, approval.decided, ticket.created, ticket.replied, ticket.resolved, brief.received, file.uploaded, invoice.created, invoice.paid, lead.created, lead.updated, booking.created, booking.cancelled, client.activated, proposal.accepted, proposal.declined, ping`.
  - `type EventType = (typeof EVENT_TYPES)[number]`; `type Audience = "client" | "admin" | "both"`.
  - `EVENTS: Record<EventType, { audience: Audience; description: string; dataSchema: ZodType }>` — the first fourteen are `"both"`; `lead.*`, `booking.*`, `client.activated`, `proposal.*` are `"admin"`; `ping` is `"both"`. `dataSchema` is `z.object({}).passthrough()` for every event in Phase 3 EXCEPT `ping` = `z.object({ endpoint_id: z.string().uuid(), sent_at: z.iso.datetime() })` (Phase 4 tightens the rest from the DTO shapes).
  - `isEventType(s: string): s is EventType`.
  - `eventsFor(audience: "client" | "admin"): EventType[]` — client → every event whose audience is `client` or `both`; admin → every event (all are `admin` or `both`).
  - `visibleTo(type: EventType, ownerType: "client" | "admin"): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/webhooks-events.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EVENTS, EVENT_TYPES, eventsFor, isEventType, visibleTo } from "../lib/webhooks/events.ts";

describe("event catalog", () => {
  it("has 22 types, every one described with an audience and a schema", () => {
    assert.equal(EVENT_TYPES.length, 22);
    for (const t of EVENT_TYPES) {
      const e = EVENTS[t];
      assert.ok(e.description.length > 10, t);
      assert.ok(["client", "admin", "both"].includes(e.audience), t);
      assert.ok(e.dataSchema.safeParse({}).success || t === "ping", t);
    }
  });
  it("splits audiences", () => {
    assert.equal(isEventType("ticket.created"), true);
    assert.equal(isEventType("nope"), false);
    assert.equal(visibleTo("lead.created", "client"), false);
    assert.equal(visibleTo("lead.created", "admin"), true);
    assert.equal(visibleTo("ticket.created", "client"), true);
    assert.equal(eventsFor("client").length, 15);
    assert.equal(eventsFor("admin").length, 22);
    assert.ok(!eventsFor("client").includes("booking.created"));
  });
  it("ping schema is strict", () => {
    assert.equal(EVENTS.ping.dataSchema.safeParse({}).success, false);
    assert.ok(EVENTS.ping.dataSchema.safeParse({ endpoint_id: "11111111-1111-4111-8111-111111111111", sent_at: "2026-09-20T00:00:00.000Z" }).success);
  });
});
```

- [ ] **Step 2: Run — expect failure** (`node --experimental-test-module-mocks --test tests/webhooks-events.test.ts`).
- [ ] **Step 3: Implement** per Interfaces (a `const` object literal keyed by every type; `eventsFor` = `EVENT_TYPES.filter(t => visibleTo(t, audience))`).
- [ ] **Step 4: Run — PASS; typecheck; lint.**
- [ ] **Step 5: Commit**

```bash
git add lib/webhooks/events.ts tests/webhooks-events.test.ts
git commit -m "Webhooks: event catalog"
```

---

### Task 2: SSRF-safe URL check

**Files:**
- Create: `lib/webhooks/url-check.ts`
- Test: `tests/webhooks-url-check.test.ts`

**Interfaces:**
- Produces: `checkWebhookUrl(input: string, opts: { allowHttp: boolean; allowPrivate?: boolean }): { ok: true; url: string } | { ok: false; reason: "invalid" | "scheme" | "host" | "length" }` — `url` is the normalised `URL.href`. Pure; no DNS. `allowPrivate: true` skips ONLY the host/IP block list (scheme, credentials and length checks still apply); it exists solely so a local end-to-end smoke can deliver to a receiver on this machine, and Task 7 only ever sets it outside production. Blocked hostnames: `localhost`, `*.localhost`, `*.internal`, `*.local`; blocked IPv4 literals: `0.0.0.0/8`, `10/8`, `127/8`, `169.254/16`, `172.16/12`, `192.168/16`, `100.64/10`; blocked IPv6 literals: `::`, `::1`, `fc00::/7`, `fe80::/10`, and IPv4-mapped forms of the above (`::ffff:10.0.0.1`). Also reject URLs with credentials (`user:pass@`).
- Also export `isBlockedHost(hostname: string): boolean` for reuse.

- [ ] **Step 1: Write the failing test**

```ts
// tests/webhooks-url-check.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkWebhookUrl, isBlockedHost } from "../lib/webhooks/url-check.ts";

const prod = { allowHttp: false };
describe("checkWebhookUrl", () => {
  it("accepts a normal https url", () => {
    assert.deepEqual(checkWebhookUrl("https://hooks.example.com/rsg?x=1", prod), { ok: true, url: "https://hooks.example.com/rsg?x=1" });
  });
  it("rejects http in prod, allows it in dev", () => {
    assert.equal(checkWebhookUrl("http://hooks.example.com/", prod).ok, false);
    assert.equal(checkWebhookUrl("http://hooks.example.com/", { allowHttp: true }).ok, true);
  });
  it("rejects private, loopback, link-local, cgnat, metadata and local names", () => {
    for (const u of [
      "https://localhost/x", "https://foo.localhost/x", "https://db.internal/x", "https://printer.local/x",
      "https://127.0.0.1/x", "https://10.1.2.3/x", "https://172.16.0.9/x", "https://172.31.255.255/x", "https://192.168.1.1/x",
      "https://169.254.169.254/latest", "https://100.64.0.1/x", "https://0.0.0.0/x",
      "https://[::1]/x", "https://[fc00::1]/x", "https://[fe80::1]/x", "https://[::ffff:10.0.0.1]/x",
    ]) assert.equal(checkWebhookUrl(u, prod).ok, false, u);
    assert.equal(checkWebhookUrl("https://172.32.0.1/x", prod).ok, true);
    assert.equal(checkWebhookUrl("https://8.8.8.8/x", prod).ok, true);
  });
  it("rejects garbage, credentials, other schemes and huge urls", () => {
    assert.deepEqual(checkWebhookUrl("not a url", prod), { ok: false, reason: "invalid" });
    assert.equal(checkWebhookUrl("https://u:p@hooks.example.com/", prod).ok, false);
    assert.equal(checkWebhookUrl("ftp://hooks.example.com/", prod).ok, false);
    assert.deepEqual(checkWebhookUrl("https://x.com/" + "a".repeat(2100), prod), { ok: false, reason: "length" });
  });
  it("isBlockedHost", () => {
    assert.equal(isBlockedHost("api.stripe.com"), false);
    assert.equal(isBlockedHost("LOCALHOST"), true);
  });
  it("allowPrivate lifts only the host block", () => {
    const dev = { allowHttp: true, allowPrivate: true };
    assert.equal(checkWebhookUrl("http://127.0.0.1:3999/ok", dev).ok, true);
    assert.equal(checkWebhookUrl("http://u:p@127.0.0.1:3999/ok", dev).ok, false);
    assert.equal(checkWebhookUrl("ftp://127.0.0.1/", dev).ok, false);
  });
});
```

- [ ] **Step 2: Run — expect failure.**
- [ ] **Step 3: Implement.** Parse with `new URL()` (throw → `invalid`); `href.length > 2048` → `length`; `username || password` → `host`; protocol not `https:` (or `http:` when `allowHttp`) → `scheme`; hostname lower-cased; strip `[`/`]` for IPv6; IPv4 detection via `/^\d{1,3}(\.\d{1,3}){3}$/` then octet math; IPv6: `::`/`::1`, `/^fc|^fd/` (fc00::/7), `/^fe[89ab]/` (fe80::/10), `::ffff:` mapped → recurse on the v4 part. Name suffix checks with `endsWith`.
- [ ] **Step 4: Run — PASS; typecheck; lint.**
- [ ] **Step 5: Commit**

```bash
git add lib/webhooks/url-check.ts tests/webhooks-url-check.test.ts
git commit -m "Webhooks: SSRF-safe endpoint URL check"
```

---

### Task 3: Endpoint store

**Files:**
- Create: `lib/webhooks/endpoints.ts`
- Test: `tests/webhooks-endpoints.test.ts`

**Interfaces:**
- Consumes: `applyCursor`, `pageResult`, `type Cursor` (`../apiv1/pagination.ts`); `ApiError`, `notFound` (`../apiv1/errors.ts`); `checkWebhookUrl` (Task 2); `isEventType`, `visibleTo`, `type EventType` (Task 1); `randomBytes` from `node:crypto`.
- Produces (all take `sb: SupabaseClient` first; test-importable):
  - `MAX_ENDPOINTS = 10`; `AUTO_DISABLE_AFTER = 20`.
  - `type Owner = { type: "client" | "admin"; id: string }`.
  - `type EndpointRow = { id, url, secret, events: string[], enabled: boolean, kind: string, description: string | null, owner_type: string | null, owner_id: string | null, api_key_id: string | null, disabled_at: string | null, failure_count: number, seq: number, created_at, updated_at }`.
  - `type EndpointDto = { id, url, events, description, enabled, disabled_at, failure_count, created_at, updated_at }` — **never `secret`**. `toEndpointDto(row)`.
  - `type DeliveryDto = { id, event_type, event_id, status, attempts, max_attempts, response_status, last_error, next_attempt_at, delivered_at, dead_lettered_at, created_at }` — **never `payload`**. `toDeliveryDto(row)`.
  - `generateSecret(): string` — `"whsec_" + randomBytes(32).toString("base64url")`.
  - `validateEvents(events: string[], owner: Owner): EventType[]` — throws `ApiError(422, "validation_failed", "Unknown or unavailable event.", { events: [bad…] })` for any not `isEventType` or not `visibleTo(type, owner.type)`; dedupes; rejects empty (422).
  - `createEndpoint(sb, owner, input: { url: string; events: string[]; description?: string; apiKeyId?: string | null }, opts: { allowHttp: boolean })` → `{ endpoint: EndpointDto; secret: string }`; URL via `checkWebhookUrl` → 422 `{ url: [reason] }`; count active (`disabled_at is null` is NOT the criterion — count ALL rows for the owner) ≥ 10 → 409 `conflict`; inserts `{ kind: "client", owner_type, owner_id, url, events, enabled: true, secret, description, api_key_id }`.
  - `listEndpoints(sb, owner): Promise<EndpointDto[]>` — `.eq("owner_type").eq("owner_id").eq("kind","client").order("created_at")`.
  - `getOwnedEndpoint(sb, owner, id): Promise<EndpointRow>` — `.eq("id").eq("owner_type").eq("owner_id").eq("kind","client").maybeSingle()` → `notFound()` when null.
  - `updateEndpoint(sb, owner, id, patch: { url?: string; events?: string[]; description?: string | null; enabled?: boolean }, opts)` → `EndpointDto`; validates like create; `enabled: true` also sets `disabled_at: null, failure_count: 0`; `enabled: false` leaves `disabled_at` alone; always `updated_at: now`.
  - `deleteEndpoint(sb, owner, id): Promise<void>` (404 if not owned; deliveries cascade).
  - `rotateSecret(sb, owner, id): Promise<{ secret: string }>`.
  - `listDeliveriesPage(sb, owner, endpointId, o: { limit: number; cursor: Cursor | null; status?: string })` → `{ data: DeliveryDto[]; next_cursor }` — verifies ownership first, then `webhook_deliveries` `.eq("endpoint_id")` [+ `.eq("status")`] → `applyCursor` → order `created_at desc, id desc` → `limit + 1` → `pageResult`.
  - `replayDelivery(sb, owner, endpointId, deliveryId): Promise<DeliveryDto>` — ownership check; row must be `dead` or `failed` else 409 `conflict`; update `{ status: "pending", attempts: 0, next_attempt_at: now, dead_lettered_at: null, last_error: null, claimed_at: null, claimed_by: null }` `.eq("id").eq("endpoint_id")` `.select("*").single()`.

- [ ] **Step 1: Write the failing test** (fake builder in the style of `tests/apiv1-paged-admin.test.ts`; record calls; `maybeSingle`/`single`/thenable):

```ts
// tests/webhooks-endpoints.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEndpoint, deleteEndpoint, getOwnedEndpoint, listDeliveriesPage, replayDelivery, rotateSecret, toEndpointDto, updateEndpoint, validateEvents, MAX_ENDPOINTS } from "../lib/webhooks/endpoints.ts";

const EP = "11111111-1111-4111-8111-111111111111";
const owner = { type: "client" as const, id: "22222222-2222-4222-8222-222222222222" };
const row = { id: EP, url: "https://hooks.example.com/a", secret: "whsec_LEAK", events: ["ticket.created"], enabled: true, kind: "client", description: null, owner_type: "client", owner_id: owner.id, api_key_id: null, disabled_at: null, failure_count: 3, seq: 0, created_at: "2026-09-20T00:00:00.000Z", updated_at: "2026-09-20T00:00:00.000Z" };

function fakeSb(state: { endpoints: Record<string, unknown>[]; deliveries: Record<string, unknown>[] }) {
  const calls: string[] = [];
  const build = (table: "webhook_endpoints" | "webhook_deliveries") => {
    let rows = state[table === "webhook_endpoints" ? "endpoints" : "deliveries"];
    let pending: Record<string, unknown> | null = null; let inserted: Record<string, unknown> | null = null;
    const q: Record<string, unknown> = {};
    for (const m of ["select", "order", "limit", "or"]) q[m] = (...a: unknown[]) => { calls.push(`${table}.${m}:${a.map(String).join("|")}`); return q; };
    q.eq = (c: string, v: unknown) => { calls.push(`${table}.eq:${c}|${v}`); rows = rows.filter((r) => r[c] === v); return q; };
    q.insert = (v: Record<string, unknown>) => { inserted = { id: "33333333-3333-4333-8333-333333333333", created_at: "t", updated_at: "t", disabled_at: null, failure_count: 0, seq: 0, ...v }; state.endpoints.push(inserted); rows = [inserted]; calls.push(`${table}.insert`); return q; };
    q.update = (v: Record<string, unknown>) => { pending = v; calls.push(`${table}.update:${JSON.stringify(v)}`); return q; };
    q.delete = () => { calls.push(`${table}.delete`); q.then = (r: (v: unknown) => void) => { for (const x of rows) { const i = state.endpoints.indexOf(x); if (i >= 0) state.endpoints.splice(i, 1); } r({ data: null, error: null }); }; return q; };
    q.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
    q.single = async () => { if (pending) for (const r of rows) Object.assign(r, pending); return { data: rows[0] ?? null, error: rows[0] ? null : { message: "0 rows" } }; };
    q.then = (r: (v: unknown) => void) => { if (pending) for (const x of rows) Object.assign(x, pending); r({ data: rows, error: null, count: rows.length }); };
    return q;
  };
  return { calls, sb: { from: build } as never };
}

describe("endpoint store", () => {
  it("DTO never carries the secret", () => {
    assert.equal("secret" in toEndpointDto(row), false);
  });
  it("validates events per audience and dedupes", () => {
    assert.deepEqual(validateEvents(["ticket.created", "ticket.created"], owner), ["ticket.created"]);
    assert.throws(() => validateEvents(["lead.created"], owner), (e: { code: string }) => e.code === "validation_failed");
    assert.throws(() => validateEvents([], owner), (e: { status: number }) => e.status === 422);
    assert.deepEqual(validateEvents(["lead.created"], { type: "admin", id: "a" }), ["lead.created"]);
  });
  it("creates with a whsec_ secret, enforces the cap and the url check", async () => {
    const f = fakeSb({ endpoints: [], deliveries: [] });
    const r = await createEndpoint(f.sb, owner, { url: "https://hooks.example.com/x", events: ["ticket.created"] }, { allowHttp: false });
    assert.ok(r.secret.startsWith("whsec_")); assert.equal("secret" in r.endpoint, false);
    assert.ok(f.calls.includes("webhook_endpoints.insert"));
    await assert.rejects(createEndpoint(f.sb, owner, { url: "https://10.0.0.1/x", events: ["ticket.created"] }, { allowHttp: false }), (e: { code: string }) => e.code === "validation_failed");
    const full = fakeSb({ endpoints: Array.from({ length: MAX_ENDPOINTS }, (_, i) => ({ ...row, id: `e${i}` })), deliveries: [] });
    await assert.rejects(createEndpoint(full.sb, owner, { url: "https://hooks.example.com/x", events: ["ticket.created"] }, { allowHttp: false }), (e: { code: string }) => e.code === "conflict");
  });
  it("ownership: other owner → 404", async () => {
    const f = fakeSb({ endpoints: [row], deliveries: [] });
    await assert.rejects(getOwnedEndpoint(f.sb, { type: "client", id: "other" }, EP), (e: { code: string }) => e.code === "not_found");
    assert.equal((await getOwnedEndpoint(f.sb, owner, EP)).id, EP);
  });
  it("re-enabling clears disabled_at and failure_count; rotate returns a new secret", async () => {
    const f = fakeSb({ endpoints: [{ ...row, disabled_at: "t", failure_count: 20 }], deliveries: [] });
    const dto = await updateEndpoint(f.sb, owner, EP, { enabled: true }, { allowHttp: false });
    assert.equal(dto.disabled_at, null); assert.equal(dto.failure_count, 0);
    const { secret } = await rotateSecret(f.sb, owner, EP);
    assert.ok(secret.startsWith("whsec_") && secret !== "whsec_LEAK");
    await deleteEndpoint(f.sb, owner, EP); assert.equal(f.calls.filter((c) => c.endsWith(".delete")).length, 1);
  });
  it("deliveries: scoped by endpoint, no payload, replay only dead/failed", async () => {
    const d = { id: "44444444-4444-4444-8444-444444444444", endpoint_id: EP, event_type: "ticket.created", event_id: "ticket.created:x:1", status: "dead", attempts: 8, max_attempts: 8, response_status: 500, last_error: "HTTP 500", next_attempt_at: "t", delivered_at: null, dead_lettered_at: "t", created_at: "2026-09-20T00:00:00.000Z", payload: { LEAK: 1 } };
    const f = fakeSb({ endpoints: [row], deliveries: [d, { ...d, id: "55555555-5555-4555-8555-555555555555", status: "delivered" }] });
    const page = await listDeliveriesPage(f.sb, owner, EP, { limit: 10, cursor: null });
    assert.ok(f.calls.includes(`webhook_deliveries.eq:endpoint_id|${EP}`));
    assert.equal(JSON.stringify(page.data).includes("LEAK"), false);
    const replayed = await replayDelivery(f.sb, owner, EP, d.id);
    assert.equal(replayed.status, "pending");
    await assert.rejects(replayDelivery(f.sb, owner, EP, "55555555-5555-4555-8555-555555555555"), (e: { code: string }) => e.code === "conflict");
  });
});
```

- [ ] **Step 2: Run — expect failure.** **Step 3: Implement** per Interfaces (use the `ChainedQuery`-cast pattern from `lib/lifecycle/paged.ts` for `applyCursor`). If the fake needs another chain method for a call you make, extend the fake rather than changing the production call shape. **Step 4: PASS; typecheck; lint.**
- [ ] **Step 5: Commit**

```bash
git add lib/webhooks/endpoints.ts tests/webhooks-endpoints.test.ts
git commit -m "Webhooks: owned endpoint store with deliveries and replay"
```

---

### Task 4: Emission + outbox hooks

**Files:**
- Modify: `lib/webhooks/outbox.ts` (`EnqueueInput`, `enqueue`, `attemptDelivery`)
- Create: `lib/webhooks/emit.ts`
- Test: `tests/webhooks-emit.test.ts` (mock.module), `tests/webhooks.test.ts` (extend if it covers `enqueue`'s filter — read it first)

**Interfaces:**
- Outbox: `EnqueueInput` gains `skipSubscriptionFilter?: boolean` — when true (and `endpointIds` given) the per-endpoint `subscribed` check is skipped (the caller already filtered). In `attemptDelivery`: on the `delivered` branch also `sb.from("webhook_endpoints").update({ failure_count: 0 }).eq("id", row.endpoint_id).gt("failure_count", 0)`; on the `dead` branch read `failure_count` (`select("failure_count").eq("id").maybeSingle()`), then `update({ failure_count: n + 1, ...(n + 1 >= AUTO_DISABLE_AFTER ? { enabled: false, disabled_at: now } : {}) })`. Only for `row.kind === "client"` (never touch registry endpoints). Both best-effort (errors logged). Import `AUTO_DISABLE_AFTER` from `./endpoints` — **check for an import cycle**: `endpoints.ts` must not import `outbox.ts`.
- `lib/webhooks/emit.ts`:
  - `emitEvent(type: EventType, data: Record<string, unknown>, opts: { entityId: string; version: string | number; clientId?: string | null }): Promise<{ queued: number }>` — never throws. Resolves endpoints: `kind='client'`, `enabled=true`, `disabled_at is null`, and (`owner_type='admin'`) OR (`owner_type='client' AND owner_id = clientId` when `clientId` given). Filters in JS: `visibleTo(type, owner_type)` and `(events as string[]).includes(type)`. If none → `{ queued: 0 }` without calling `enqueue`. Payload = `{ ...data, ...(clientId ? { client_id: clientId } : {}) }`. Calls `enqueue({ eventType: type, eventId: \`${type}:${entityId}:${version}\`, payload, kind: "client", endpointIds, skipSubscriptionFilter: true })`.
  - `sendTestEvent(endpointId: string): Promise<{ queued: number }>` — `enqueue({ eventType: "ping", eventId: \`ping:${endpointId}:${Date.now()}\`, payload: { endpoint_id, sent_at }, kind: "client", endpointIds: [endpointId], skipSubscriptionFilter: true })`.
  - `emit.ts` may use `@/` (it imports outbox which does).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/webhooks-emit.test.ts
import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

const CL = "22222222-2222-4222-8222-222222222222";
const endpoints = [
  { id: "e-client-sub", kind: "client", enabled: true, disabled_at: null, owner_type: "client", owner_id: CL, events: ["ticket.created"] },
  { id: "e-client-other", kind: "client", enabled: true, disabled_at: null, owner_type: "client", owner_id: "other", events: ["ticket.created"] },
  { id: "e-client-unsub", kind: "client", enabled: true, disabled_at: null, owner_type: "client", owner_id: CL, events: ["invoice.paid"] },
  { id: "e-admin", kind: "client", enabled: true, disabled_at: null, owner_type: "admin", owner_id: "a1", events: ["ticket.created", "lead.created"] },
  { id: "e-disabled", kind: "client", enabled: false, disabled_at: "t", owner_type: "admin", owner_id: "a1", events: ["ticket.created"] },
  { id: "e-registry", kind: "registry", enabled: true, disabled_at: null, owner_type: null, owner_id: null, events: [] },
];
const enqueued: Record<string, unknown>[] = [];
mock.module("@/lib/scheduling/db", { namedExports: { requireSupabase: () => ({ from: () => { const q: Record<string, unknown> = {}; for (const m of ["select", "eq", "is", "or"]) q[m] = () => q; q.then = (r: (v: unknown) => void) => r({ data: endpoints, error: null }); return q; } }) } });
mock.module("@/lib/webhooks/outbox", { namedExports: { enqueue: async (i: Record<string, unknown>) => { enqueued.push(i); return { queued: (i.endpointIds as string[]).length }; } } });
const { emitEvent, sendTestEvent } = await import("../lib/webhooks/emit.ts");

describe("emitEvent", () => {
  it("fans out to the owning client's subscribed endpoints and every subscribed admin endpoint", async () => {
    const r = await emitEvent("ticket.created", { id: "t1" }, { entityId: "t1", version: 1, clientId: CL });
    assert.equal(r.queued, 2);
    const call = enqueued.at(-1)!;
    assert.deepEqual((call.endpointIds as string[]).sort(), ["e-admin", "e-client-sub"]);
    assert.equal(call.eventId, "ticket.created:t1:1");
    assert.equal(call.skipSubscriptionFilter, true);
    assert.deepEqual(call.payload, { id: "t1", client_id: CL });
  });
  it("admin-only events never reach client endpoints; nothing eligible → no enqueue", async () => {
    const before = enqueued.length;
    const r = await emitEvent("lead.created", { id: "l1" }, { entityId: "l1", version: "2026" });
    assert.deepEqual(enqueued.at(-1)!.endpointIds, ["e-admin"]);
    const none = await emitEvent("invoice.created", { id: "i1" }, { entityId: "i1", version: 1, clientId: "nobody" });
    assert.equal(none.queued, 0); assert.equal(enqueued.length, before + 1); assert.ok(r.queued >= 1);
  });
  it("sendTestEvent targets exactly one endpoint with a ping", async () => {
    await sendTestEvent("e-client-unsub");
    const call = enqueued.at(-1)!;
    assert.equal(call.eventType, "ping"); assert.deepEqual(call.endpointIds, ["e-client-unsub"]);
  });
});
```

Also extend `tests/webhooks.test.ts` (it registers the `@/` hook itself — read how it mocks `requireSupabase`) with one case proving `enqueue` with `skipSubscriptionFilter: true` inserts for an endpoint whose `events` does NOT include the type, and without the flag it still skips. If that file cannot exercise `enqueue` hermetically, put the case in `tests/webhooks-emit.test.ts` using a second `mock.module` layout and say so in the report.

- [ ] **Step 2: Run — expect failure.** **Step 3: Implement.** **Step 4: `node --experimental-test-module-mocks --test tests/webhooks-emit.test.ts tests/webhooks.test.ts`; typecheck; lint; `npm test`.**
- [ ] **Step 5: Commit**

```bash
git add lib/webhooks/outbox.ts lib/webhooks/emit.ts tests/webhooks-emit.test.ts tests/webhooks.test.ts
git commit -m "Webhooks: owner-scoped emission and auto-disable on dead letters"
```

---

### Task 5: Emission call sites — projects, approvals, tickets, messages

**Files:**
- Modify: `lib/lifecycle/projects.ts` (`approveMilestone`, `requestMilestoneChanges`, `updateTask`, `updateMilestone` when status becomes `completed`), `lib/lifecycle/workspace.ts` (`createApproval`, `decideApproval`, `addMessage` for tickets), `lib/lifecycle/support.ts` (`createTicket`, `resolveTicket`)
- Test: `tests/webhooks-callsites-lifecycle.test.ts`

**Interfaces:**
- Consumes: `emitEvent` (Task 4); DTOs `toMilestoneDto`, `toTaskDto`, `toApprovalDto`, `toTicketDto`, `toMessageDto` from `@/lib/apiv1/serializers`.
- Rule: each call site is `void emitEvent(type, dto, { entityId: row.id, version: row.updated_at ?? row.created_at, clientId })` placed AFTER the DB write succeeds and BEFORE the function returns; `void` (not awaited — `emitEvent` never throws and must not slow the caller). Map: `approveMilestone` → `milestone.approved` (clientId = project.client_id); `requestMilestoneChanges` → `milestone.changes_requested`; `updateMilestone` → `milestone.completed` only when the new status is `completed`; `updateTask` → `task.completed` only when patch sets `status: "done"`; `createApproval` → `approval.requested`; `decideApproval` → `approval.decided`; `createTicket` → `ticket.created`; `addMessage` with `ticketId` and `internal === false` → `ticket.replied` (data = message DTO + `ticket_id`); `resolveTicket` → `ticket.resolved`. `project.updated` fires from `updateProject`.

- [ ] **Step 1: Write the failing test.** Skeleton (extend the fake builder per function after reading each one — they differ in which chain methods they call):

```ts
// tests/webhooks-callsites-lifecycle.test.ts
import "./_alias-hook.ts";
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

const emitted: { type: string; data: Record<string, unknown>; opts: Record<string, unknown> }[] = [];
mock.module("@/lib/webhooks/emit", { namedExports: { emitEvent: async (type: string, data: Record<string, unknown>, opts: Record<string, unknown>) => { emitted.push({ type, data, opts }); return { queued: 1 }; }, sendTestEvent: async () => ({ queued: 1 }) } });

/** Generic fake: every chain method returns the builder; terminal calls resolve `row`. */
let row: Record<string, unknown> = {};
function fakeSb() {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "is", "or", "order", "limit", "insert", "update", "delete", "gt"]) q[m] = () => q;
  q.maybeSingle = async () => ({ data: row, error: null });
  q.single = async () => ({ data: row, error: null });
  q.then = (r: (v: unknown) => void) => r({ data: [row], error: null });
  return { from: () => q, rpc: async () => ({ data: 1, error: null }) };
}
mock.module("@/lib/lifecycle/core", { namedExports: { requireSupabase: () => fakeSb(), nowIso: () => "2026-09-20T00:00:00.000Z", newToken: () => "tok", siteUrl: () => "http://x", FILES_BUCKET: "rsg-files", links: {}, firstNameOf: () => "A", periodMonth: () => "2026-09", periodLabel: () => "Sep 2026", LifecycleUnavailableError: class extends Error {} } });
mock.module("@/lib/lifecycle/activity", { namedExports: { logClientActivity: async () => {} } });

const projects = await import("../lib/lifecycle/projects.ts");
const workspace = await import("../lib/lifecycle/workspace.ts");
const support = await import("../lib/lifecycle/support.ts");
const PROJECT = "11111111-1111-4111-8111-111111111111"; const CLIENT = "22222222-2222-4222-8222-222222222222"; const ID = "33333333-3333-4333-8333-333333333333";

describe("lifecycle call sites emit", () => {
  beforeEach(() => { emitted.length = 0; });
  it("createTicket → ticket.created with the client id", async () => {
    row = { id: ID, client_id: CLIENT, number: 7, status: "open", subject: "s", description: "d", category: "bug", priority: "normal", project_id: null, opened_by_name: "n", created_at: "t", updated_at: "t", last_activity_at: "t" };
    await support.createTicket({ clientId: CLIENT, category: "bug", subject: "s", description: "d", openedByName: "n" });
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0]!.type, "ticket.created"); assert.equal(emitted[0]!.opts.entityId, ID); assert.equal(emitted[0]!.opts.clientId, CLIENT);
  });
  it("addMessage on a ticket emits ticket.replied only for non-internal messages", async () => {
    row = { id: ID, client_id: CLIENT, ticket_id: ID, author_type: "admin", author_name: "n", body: "b", internal: true, mentions: [], created_at: "t", edited_at: null, project_id: null, request_id: null };
    await workspace.addMessage({ clientId: CLIENT, ticketId: ID, authorType: "admin", authorName: "n", body: "b", internal: true });
    assert.equal(emitted.length, 0);
    row = { ...row, internal: false };
    await workspace.addMessage({ clientId: CLIENT, ticketId: ID, authorType: "client", authorName: "n", body: "b" });
    assert.equal(emitted.at(-1)?.type, "ticket.replied");
  });
  it("updateTask emits task.completed only when status becomes done", async () => {
    row = { id: ID, project_id: PROJECT, status: "done", title: "t", description: "", kind: "general", assignee_party: "client", milestone_id: null, due_at: null, completed_at: "t", sort_order: 0, created_at: "t", updated_at: "t", assignee_admin_id: null, assignee_client_user_id: null };
    await projects.updateTask(ID, { title: "renamed" });
    assert.equal(emitted.length, 0);
    await projects.updateTask(ID, { status: "done" });
    assert.equal(emitted.at(-1)?.type, "task.completed");
  });
  // + one `it` each for approveMilestone (milestone.approved), requestMilestoneChanges (milestone.changes_requested),
  //   updateMilestone status→completed (milestone.completed) and status→in_progress (nothing), createApproval (approval.requested),
  //   decideApproval (approval.decided), resolveTicket (ticket.resolved), updateProject (project.updated) — same shape as above.
});
```

`updateTask` needs the project's `client_id` for `clientId` — if the function does not already load the project, load it (`getProject(task.project_id)`) inside the emission branch only. Every `it` asserts `entityId`/`clientId`, not just `type`.
- [ ] **Step 2–4: Run (RED) → implement → PASS; `npm test`; typecheck; lint.**
- [ ] **Step 5: Commit**

```bash
git add lib/lifecycle/projects.ts lib/lifecycle/workspace.ts lib/lifecycle/support.ts tests/webhooks-callsites-lifecycle.test.ts
git commit -m "Webhooks: emit project, approval and ticket events from the lib"
```

---

### Task 6: Emission call sites — briefs, files, billing, leads, bookings, clients, proposals

**Files:**
- Modify: `lib/briefs/ingest.ts` (`brief.received`, after a NON-duplicate ingest; `clientId` only when the caller passes one — add an optional `clientId` param and have `lib/apiv1/resources/briefs.ts` pass it), `lib/lifecycle/files.ts` (`createFileRecord` → `file.uploaded`), `lib/lifecycle/billing.ts` (`createInvoice` → `invoice.created`; `handleStripeEvent` outcome `paid` → `invoice.paid`), `lib/store.ts` (`saveLead` → `lead.created` when a row id exists; `updateLead` → `lead.updated`), `lib/scheduling/booking.ts` (`createBooking` ok → `booking.created`; `cancelBooking` ok → `booking.cancelled`), `lib/lifecycle/access.ts` (`provisionClientForOpportunity` → `client.activated`), `lib/lifecycle/proposals.ts` (`approveProposal` → `proposal.accepted`; `requestRevision` → `proposal.declined`)
- Test: `tests/webhooks-callsites-domain.test.ts`

**Interfaces:**
- Consumes: `emitEvent`; DTOs `toBriefDto`, `toFileDto`, `toInvoiceDto` (`@/lib/apiv1/serializers`), `toLeadDto`, `toProposalDto` (`@/lib/apiv1/serializers-admin`); for bookings a small inline DTO `{ id, appointment_type_id, starts_at, status }` (read the booking row shape in `lib/scheduling/booking.ts`); for `client.activated` `{ id, company, name, email, status }`.
- `lib/store.ts` is imported by node tests already (via mocks) — `emit.ts` uses `@/`, so import it in `store.ts` with `@/lib/webhooks/emit` like its other imports; the existing store tests mock nothing there, so confirm `npm test` still passes (emission resolves `requireSupabase` lazily inside `emitEvent`, which returns `{ queued: 0 }` when Supabase is unconfigured — make sure `emitEvent` short-circuits on `!isSupabaseConfigured()` BEFORE touching the db, and add that case to `tests/webhooks-emit.test.ts` if Task 4 didn't).

- [ ] **Step 1: Test** — same mocking approach as Task 5: one `it` per function asserting the event type/entityId/clientId, plus negative cases (`ingestBrief` duplicate → no emit; `handleStripeEvent` non-paid outcome → no emit; `saveLead` without a stored id → no emit).
- [ ] **Step 2–4: RED → implement → PASS; `npm test`; typecheck; lint.**
- [ ] **Step 5: Commit**

```bash
git add lib/briefs/ingest.ts lib/apiv1/resources/briefs.ts lib/lifecycle/files.ts lib/lifecycle/billing.ts lib/store.ts lib/scheduling/booking.ts lib/lifecycle/access.ts lib/lifecycle/proposals.ts tests/webhooks-callsites-domain.test.ts
git commit -m "Webhooks: emit brief, file, billing, lead, booking, client and proposal events"
```

---

### Task 7: Management API (v1)

**Files:**
- Create: `lib/apiv1/resources/webhooks.ts`
- Create routes: `app/api/v1/webhooks/route.ts` (GET, POST), `app/api/v1/webhooks/[id]/route.ts` (GET, PATCH, DELETE), `app/api/v1/webhooks/[id]/rotate-secret/route.ts` (POST), `app/api/v1/webhooks/[id]/test/route.ts` (POST), `app/api/v1/webhooks/[id]/deliveries/route.ts` (GET), `app/api/v1/webhooks/[id]/deliveries/[did]/replay/route.ts` (POST), `app/api/v1/webhooks/events/route.ts` (GET — the catalog for the caller's audience)
- Test: `tests/webhooks-api.test.ts`

**Interfaces:**
- Consumes: Task 3 store, Task 4 `sendTestEvent`, Task 1 `eventsFor`/`EVENTS`; `requireUuid`, `parseListParams`, `ApiError`; `auditVia` (`../admin.ts`) and `logClientActivity` (`@/lib/lifecycle/activity`).
- Produces: `ownerOf(principal: Principal | null): Owner` (client → `{ type:"client", id: portal.client.id }`; admin → `{ type:"admin", id: adminId }`; null → 401 `unauthenticated`); `urlOpts()` = `{ allowHttp: process.env.NODE_ENV !== "production", allowPrivate: process.env.NODE_ENV !== "production" && process.env.WEBHOOK_URL_ALLOW_PRIVATE === "1" }` (add `WEBHOOK_URL_ALLOW_PRIVATE=` to `.env.example` with the comment `# Dev only: lets webhook endpoints point at private/loopback addresses for local delivery tests. Ignored in production.`); `audit(principal, action, endpointId)` helper (admin → `auditVia`, client → `logClientActivity({ clientId, actorType: "client", actorName: \`${keyName} (API)\`, action, entityType: "webhook_endpoint", entityId })`); schemas `createBody = z.object({ url: z.string().max(2048), events: z.array(z.string()).min(1).max(30), description: z.string().max(200).optional() })`, `patchBody = z.object({ url…optional, events…optional, description: z.string().max(200).nullable().optional(), enabled: z.boolean().optional() }).refine(non-empty)`, `deliveriesQuery = z.object({ status: z.enum(["pending","sending","delivered","failed","dead"]).optional(), limit…, cursor… })`; handlers `listWebhooks`, `createWebhook` (201, `{ data: { ...endpoint, secret } }` — the ONLY place the secret appears besides rotate), `getWebhook`, `patchWebhook`, `deleteWebhook` (`{ data: { id, deleted: true } }`), `rotateWebhookSecret` (`{ data: { id, secret } }`), `testWebhook` (`{ status: 202, data: { queued } }`), `listWebhookDeliveries`, `replayWebhookDelivery`, `listWebhookEvents` (`{ data: eventsFor(owner.type).map(t => ({ type: t, description, audience })) }`).
- Routes: `auth` is NOT a single principal type — these routes serve both. The pipeline's `auth` accepts `"client" | "admin" | "none"`; use `auth: "none"` + `scopes` is a registration error. **Ruling:** extend the pipeline minimally — add `auth: "any"` to `AuthMode` in `lib/apiv1/types.ts`, and in `pipeline.ts` treat `"any"` as "a key is required (401 if missing) but either principal type passes"; scopes still enforced. Add a pipeline test for `"any"` (keyless → 401; client key → 200; admin key → 200). All webhook routes: `auth: "any"`, `scopes: ["webhooks:manage"]`; writes `idempotent: true`; operationIds `listWebhooks, createWebhook, getWebhook, updateWebhook, deleteWebhook, rotateWebhookSecret, testWebhook, listWebhookDeliveries, replayWebhookDelivery, listWebhookEvents`.

- [ ] **Step 1: Tests** — (a) append the `auth: "any"` matrix to `tests/apiv1-pipeline.test.ts`; (b) `tests/webhooks-api.test.ts` with `mock.module` on `@/lib/webhooks/endpoints` (record calls, return canned DTOs), `@/lib/webhooks/emit`, `@/lib/lifecycle/core`, `@/lib/audit`, `@/lib/lifecycle/activity`: assert `createWebhook` returns 201 with `secret` present and audits `webhook.create`; `getWebhook` response has no `secret`; client principal → `ownerOf` = client id, admin → adminId; `listWebhookEvents` for a client omits `lead.created`; `testWebhook` → 202 and `sendTestEvent` called with the endpoint id after an ownership check; `replayWebhookDelivery` audits `webhook.replay`; a null principal → 401; `urlOpts()` returns `allowPrivate: false` when `NODE_ENV === "production"` even with the env var set (stub `process.env` in the test and restore it).
- [ ] **Step 2–4: RED → implement (pipeline `"any"`, resource module, 7 route files) → PASS; `npm test`; typecheck; lint; dev-server: `curl -i localhost:3123/api/v1/webhooks` → 401; `curl -i localhost:3123/api/v1/webhooks/events` → 401.**
- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/types.ts lib/apiv1/pipeline.ts tests/apiv1-pipeline.test.ts lib/apiv1/resources/webhooks.ts app/api/v1/webhooks tests/webhooks-api.test.ts
git commit -m "Webhooks: management API for client and admin keys"
```

---

### Task 8: Cookie routes + Webhooks UI

**Files:**
- Create: `app/api/portal/webhooks/route.ts` (GET, POST), `app/api/portal/webhooks/[id]/route.ts` (PATCH, DELETE), `app/api/portal/webhooks/[id]/rotate/route.ts` (POST), `app/api/portal/webhooks/[id]/test/route.ts` (POST), `app/api/portal/webhooks/[id]/deliveries/route.ts` (GET), `app/api/portal/webhooks/[id]/deliveries/[did]/replay/route.ts` (POST); the same six under `app/api/admin/webhooks/`.
- Create: `components/shared/WebhooksManager.tsx`
- Modify: `app/portal/developers/page.tsx` (second section "Webhooks" under the API-keys manager), `components/admin/ApiKeysAdminPanel.tsx` (a `TabBar`-style toggle "API keys | Webhooks"; reuse `components/portal/ui.tsx` `TabBar` or the admin console's own tab styling — say which).

**Interfaces:**
- Cookie routes reuse `portalKeyGuard()` / `adminKeyGuard()` from `lib/apiv1/route-guards.ts` (they already gate on the platform flag + Supabase + role/MFA), then call the Task 3 store with `owner` = `{ type:"client", id: ctx.client.id }` / `{ type:"admin", id: ctx.admin.id }`, the same `urlOpts()` exported from `lib/apiv1/resources/webhooks.ts`, and the same audit calls as the v1 handlers (admin → `writeAuditEvent` actorType admin; portal → `logClientActivity`). Response shapes: `GET` → `{ endpoints, events }` (events = `eventsFor(owner.type)` with descriptions); `POST` → 201 `{ endpoint, secret }`; `PATCH` → `{ endpoint }`; `DELETE` → `{ ok: true }`; rotate → `{ secret }`; test → 202 `{ queued }`; deliveries → `{ data, meta }`; replay → `{ delivery }`. Map store `ApiError`s to `{ error, code, details }` with the error's status (as the key routes do).
- `WebhooksManager` props `{ endpoint: string; events: { type: string; description: string }[]; initialEndpoints: EndpointDto[] }` (`"use client"`; mutations via `postJson`/`patchJson`/`getCsrfToken` from `@/lib/api`). Table: URL (truncated, mono) · Events (chips, "+N") · Status (`enabled` / `disabled` / `auto-disabled` when `disabled_at`) · Failures · Actions (Edit, Test, Deliveries, Rotate, Delete). Create/Edit modal: URL input, description, event checkboxes grouped by prefix (`project`, `milestone`, …). One-time secret reveal after create/rotate with copy button and "This is the only time we'll show it." Deliveries drawer/modal: last 25 (status pill, event, attempts, last error, time) with a Replay button on `dead`/`failed` rows; "Load more" via cursor. Confirm modals for Delete and Rotate. Accessible names everywhere; ≤ ~250 lines per file (split a `WebhookDeliveries.tsx` if needed).
- Portal page: load `listEndpoints(requireSupabase(), owner).catch(() => [])` and render the manager below the keys manager. Admin panel: fetch `/api/admin/webhooks` on tab switch.

- [ ] **Step 1: Implement routes + UI.** No hermetic tests for cookie routes/React (repo convention). **Step 2: `npm run typecheck && npm run lint && npm test && npm run build`.** **Step 3: dev-server (flags on): `/api/portal/webhooks` → 401; `/api/admin/webhooks` → 401; `/portal/developers` → 307 to login; kill the server.** Add `/portal/developers` is already in the responsive-audit route list — no change.
- [ ] **Step 4: Commit**

```bash
git add app/api/portal/webhooks app/api/admin/webhooks components/shared/WebhooksManager.tsx components/shared/WebhookDeliveries.tsx app/portal/developers/page.tsx components/admin/ApiKeysAdminPanel.tsx
git commit -m "Webhooks: portal and admin management UI"
```

(Drop `WebhookDeliveries.tsx` from the `git add` if you didn't split it.)

---

### Task 9: Docs, verification, live end-to-end delivery smoke

**Files:**
- Modify: `docs/api-platform.md` (new "Webhooks" section: catalog table with audiences, subscription semantics, payload envelope `{ id, type, sequence, created_at, data }`, signature verification example in Node using `x-rsg-timestamp`/`x-rsg-signature` and `sha256(secret, \`${ts}.${body}\`)` with the 5-minute tolerance, retry/backoff/dead-letter behaviour, auto-disable at 20, the management endpoints table, URL rules, the 10-endpoint cap, "receivers MUST dedupe on `id`"), `docs/webhooks.md` (already exists — add a pointer to the new section rather than duplicating).

- [ ] **Step 1: Docs** (≤ 300 lines total for `api-platform.md`; every code path stated must match `lib/webhooks/*`).
- [ ] **Step 2: Full verification** `npm test && npm run typecheck && npm run lint && npm run build`.
- [ ] **Step 3: Live smoke (temporary data, delete everything after):** throwaway script + a throwaway local receiver (`node` http server on port 3999 that records each request's headers/body, verifies the signature with `verifySignature` from `lib/webhooks/sign.ts`, and responds 200; a second path `/fail` responds 500). With `API_PLATFORM_ENABLED=true npx next dev -p 3123`: create a temp client + client key (`webhooks:manage tickets:write tickets:read`) as in Phase 1's Task 20; first `POST /api/v1/webhooks` with `url: http://127.0.0.1:3999/ok` WITHOUT `WEBHOOK_URL_ALLOW_PRIVATE` → expect **422** (`{ url: ["host"] }`) — proves the block list is live; then restart the dev server with `WEBHOOK_URL_ALLOW_PRIVATE=1` and create the endpoint subscribed to `ticket.created` + `ping` → 201 with secret; `POST /webhooks/{id}/test` → 202; run the deliverer (`deliverPendingWebhooks(20)` from the script) → receiver got a `ping` with a VALID signature; `POST /api/v1/tickets` → 201; deliver → receiver got `ticket.created` whose `data.id` is the ticket and `client_id` the temp client; `GET /webhooks/{id}/deliveries` → both `delivered`; `PATCH` the url to `/fail`; create another ticket; deliver → `failed` with attempts 1; `POST …/replay` on it → pending; `GET /webhooks/events` (client) omits `lead.created`; `DELETE /webhooks/{id}` → deliveries cascade. Teardown: tickets/messages, `webhook_deliveries`/`webhook_endpoints` for the owner, `api_*` rows, `client_activity`, the client; print counts; kill both servers.
- [ ] **Step 4: Commit docs**

```bash
git add docs/api-platform.md docs/webhooks.md
git commit -m "Webhooks: document the catalog, signing and management API"
```

Then stop — the controller runs the final whole-branch review before any PR.
