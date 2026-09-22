# API Platform — Phase 4 Implementation Plan (OpenAPI + developer docs)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate an OpenAPI 3.1 document from the routes that already exist (via `withApi`'s registration) plus the webhook event catalog, serve it at `GET /api/v1/openapi.json`, and render a public `/developers` reference page from it — with tests that make an undocumented endpoint impossible.

**Architecture:** `withApi` already registers every operation's `meta`; Phase 4 (1) attaches that registration to the returned handler so a builder can read `{ method, meta, body, query }` off a route module's exports, (2) generates a checked-in static import list of every `app/api/v1/**/route.ts` (asserted current by a test) so `buildOpenApi()` can import each module and derive its path from the file location, (3) converts zod schemas with zod v4's built-in `z.toJSONSchema()`, and (4) tightens `meta.response` from `z.any()` to real DTO schemas so the spec documents responses. The `/developers` page is a server component that renders the built document with the site's existing primitives — no third-party doc UI.

**Tech Stack:** Next.js 15 (server components), zod 4 (`z.toJSONSchema`), `node --test` + `mock.module`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-15-api-platform-design.md` §5 (5.1 spec generation, 5.2 `/developers` page, 5.3 guardrails), plus §2.10 (flag off → `openapi.json` and `/developers` 404). Phases 1–3 are on this branch; read `lib/apiv1/pipeline.ts`, `lib/apiv1/registry.ts`, `lib/apiv1/types.ts`, `lib/webhooks/events.ts` and `docs/api-platform.md` before starting.

## Global Constraints

- Work on `feat/api-platform` in the existing worktree `Website/.claude/worktrees/api-platform` (HEAD ≥ `b748c7b`). Run every command from there.
- No new dependencies. No third-party doc UI (Swagger/Redoc). Mermaid is not needed.
- Conventions inherited from Phases 1–3: inside `lib/apiv1/` relative imports with `.ts` extensions, no `@/`, no enums / parameter properties / namespaces, no `any`. Exception: `lib/apiv1/openapi-routes.ts` (generated) and `lib/apiv1/openapi.ts` import route modules via `@/app/...` and are therefore tested through `tests/_alias-hook.ts` + `mock.module`. Route files and pages may use `@/`.
- `npm test` = `node --experimental-test-module-mocks --test tests/*.test.ts`.
- OpenAPI document: `openapi: "3.1.0"`; `info.title = "Redmont Strategies Group API"`, `info.version` = `package.json` version (static import, as `public-status.ts` does); `servers: [{ url: "https://redmontstrategiesgroup.com" }]` (use `SITE_URL` from `lib/site.ts`); `components.securitySchemes.bearerAuth = { type: "http", scheme: "bearer", bearerFormat: "rsg_live_…" }`; every authenticated operation gets `security: [{ bearerAuth: [] }]` and `x-scopes: [...]`; `x-idempotent: true` and an `Idempotency-Key` header parameter on idempotent operations; `x-audience: "client" | "admin" | "any" | "public"`; shared `components.schemas.Error` (the envelope from `lib/apiv1/errors.ts`) referenced by every operation's `4XX`/`5XX` responses; `components.parameters.limit` / `cursor` for list operations; a `webhooks` map (OpenAPI 3.1 native) built from `EVENT_TYPES` with the signature headers documented.
- Paths are derived from file locations: `app/api/v1/tickets/[id]/route.ts` → `/api/v1/tickets/{id}`; `[entity]` → `{entity}` with an `enum` of `actions|opportunities|risks|ideas`.
- `GET /api/v1/openapi.json`: keyless, `Cache-Control: public, max-age=3600`, **404** (plain JSON `{ error: "Not found." }`) when `API_PLATFORM_ENABLED` is not `"true"`. It bypasses `withApi` (it must not register itself, must not be rate-limited, and must not log usage). `/developers` also 404s (`notFound()`) when the flag is off.
- Guardrails (§5.3), all as tests: (a) every `app/api/v1/**/route.ts` handler export appears in the spec — an undocumented endpoint fails CI; (b) every example request in the spec validates against its own zod schema; (c) structural assertions (required top-level keys, every path item has ≥1 operation with a unique `operationId`, every `$ref` resolves); (d) the generated import list matches the filesystem.
- Commit trailer: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`; exact subjects as given. Per task: `npm run typecheck && npm run lint`; focused tests; full `npm test` before each commit.

---

## File map

| File | Responsibility |
|---|---|
| `lib/apiv1/pipeline.ts`, `lib/apiv1/registry.ts`, `lib/apiv1/types.ts` (modify) | registration carries `body`/`query`; `operationOf(handler)` |
| `scripts/gen-v1-index.mjs` | writes `lib/apiv1/openapi-routes.ts` from the filesystem |
| `lib/apiv1/openapi-routes.ts` (generated, committed) | `V1_ROUTES: { path: string; file: string; load: () => Promise<Record<string, unknown>> }[]` |
| `lib/apiv1/json-schema.ts` | `zodToSchema(schema)`, `queryToParameters(schema)`, `exampleFor(schema)` |
| `lib/apiv1/response-schemas.ts` | zod schemas for every DTO + `envelope()`/`listEnvelope()` |
| `lib/apiv1/openapi.ts` | `buildOpenApi()` (memoised), `openApiForRoutes(routes)` (pure core, testable) |
| `app/api/v1/openapi.json/route.ts` | serves the document |
| `content/developers/*.md` → `lib/developers/content.ts` | prose sections as TS string constants (no markdown pipeline exists in this repo; keep prose in code) |
| `components/developers/*.tsx`, `app/(marketing)/developers/page.tsx` | the reference page |
| `tests/apiv1-openapi*.test.ts`, `tests/apiv1-response-schemas.test.ts` | tests |

---

### Task 1: Registration carries request schemas; handlers expose their operation

**Files:**
- Modify: `lib/apiv1/types.ts`, `lib/apiv1/registry.ts`, `lib/apiv1/pipeline.ts`
- Test: `tests/apiv1-pipeline.test.ts` (append), `tests/apiv1-registry.test.ts` (new)

**Interfaces:**
- `RegisteredOperation` gains `body?: ZodType; query?: ZodType; rateLimit?: { limit: number; windowMs: number }`.
- `withApi` registers them and attaches the registration to the returned handler: `Object.defineProperty(handler, OPERATION_KEY, { value: op, enumerable: false })` where `export const OPERATION_KEY = Symbol.for("rsg.apiv1.operation")`.
- `export function operationOf(fn: unknown): RegisteredOperation | null` in `registry.ts`.

- [ ] **Step 1: Tests**

```ts
// tests/apiv1-registry.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { withApi } from "../lib/apiv1/pipeline.ts";
import { listOperations, operationOf, resetOperations } from "../lib/apiv1/registry.ts";

const deps = { enabled: () => true, resolveKey: async () => null, resolvePrincipal: async () => null, rateLimit: async () => true, clientIp: () => "1.1.1.1", idempotency: null, usage: null };

describe("operation registration", () => {
  it("attaches the operation (with body/query/rateLimit) to the handler", () => {
    resetOperations();
    const body = z.object({ a: z.string() });
    const query = z.object({ q: z.string().optional() });
    const h = withApi("POST", { auth: "client", scopes: ["tickets:write"], idempotent: true, body, query, rateLimit: { limit: 5, windowMs: 1000 }, meta: { operationId: "opA", summary: "A", tag: "T", response: z.any() } }, async () => ({ data: 1 }), deps);
    const op = operationOf(h);
    assert.ok(op);
    assert.equal(op!.operationId, "opA"); assert.equal(op!.method, "POST"); assert.equal(op!.body, body); assert.equal(op!.query, query);
    assert.deepEqual(op!.rateLimit, { limit: 5, windowMs: 1000 }); assert.deepEqual(op!.scopes, ["tickets:write"]); assert.equal(op!.idempotent, true);
    assert.equal(listOperations().length, 1);
    assert.equal(operationOf(() => {}), null); assert.equal(operationOf(undefined), null);
  });
});
```

- [ ] **Step 2: RED → Step 3: implement → Step 4: `node --experimental-test-module-mocks --test tests/apiv1-registry.test.ts tests/apiv1-pipeline.test.ts`; typecheck; lint.**
- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/types.ts lib/apiv1/registry.ts lib/apiv1/pipeline.ts tests/apiv1-registry.test.ts
git commit -m "OpenAPI: route handlers expose their registered operation"
```

---

### Task 2: Generated route index

**Files:**
- Create: `scripts/gen-v1-index.mjs`, `lib/apiv1/openapi-routes.ts` (generated output, committed)
- Modify: `package.json` scripts: `"gen:v1-index": "node scripts/gen-v1-index.mjs"`
- Test: `tests/apiv1-openapi-index.test.ts`

**Interfaces:**
- `scripts/gen-v1-index.mjs`: walks `app/api/v1/**/route.ts` (sorted, POSIX paths), skips `app/api/v1/openapi.json/route.ts`, converts `[x]` → `{x}`, and writes `lib/apiv1/openapi-routes.ts`:

```ts
// GENERATED by scripts/gen-v1-index.mjs — do not edit. Run `npm run gen:v1-index`.
export type V1Route = { path: string; file: string; load: () => Promise<Record<string, unknown>> };
export const V1_ROUTES: V1Route[] = [
  { path: "/api/v1/admin/analytics/pageviews", file: "app/api/v1/admin/analytics/pageviews/route.ts", load: () => import("@/app/api/v1/admin/analytics/pageviews/route") },
  …
];
```

  Also exports `export function expectedRouteFiles(): string[]` returning the same `file` list (so the test can compare without importing route modules).
- The test globs the filesystem with `node:fs` (recursive `readdirSync` with `withFileTypes`) and asserts equality with `expectedRouteFiles()`; a stale index fails with a message naming `npm run gen:v1-index`. Because `openapi-routes.ts` has `@/` imports in the `load` thunks (never executed by this test), import it after `./_alias-hook.ts`.

- [ ] **Step 1: Test**

```ts
// tests/apiv1-openapi-index.test.ts
import "./_alias-hook.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return routeFiles(p);
    return d.name === "route.ts" ? [path.relative(root, p).split(path.sep).join("/")] : [];
  });
}

describe("v1 route index", () => {
  it("matches the filesystem (run `npm run gen:v1-index` if this fails)", async () => {
    const { expectedRouteFiles, V1_ROUTES } = await import("../lib/apiv1/openapi-routes.ts");
    const onDisk = routeFiles(path.join(root, "app/api/v1")).filter((f) => !f.endsWith("openapi.json/route.ts")).sort();
    assert.deepEqual(expectedRouteFiles(), onDisk);
    assert.equal(V1_ROUTES.length, onDisk.length);
    for (const r of V1_ROUTES) { assert.ok(r.path.startsWith("/api/v1/"), r.path); assert.ok(!r.path.includes("["), r.path); }
    assert.ok(V1_ROUTES.some((r) => r.path === "/api/v1/tickets/{id}"));
    assert.ok(V1_ROUTES.some((r) => r.path === "/api/v1/admin/{entity}/{id}"));
  });
});
```

- [ ] **Step 2–4: RED (no index) → write the script, run `npm run gen:v1-index`, commit the output → PASS; typecheck; lint.**
- [ ] **Step 5: Commit**

```bash
git add scripts/gen-v1-index.mjs lib/apiv1/openapi-routes.ts package.json tests/apiv1-openapi-index.test.ts
git commit -m "OpenAPI: generated index of v1 route modules"
```

---

### Task 3: Response schemas

**Files:**
- Create: `lib/apiv1/response-schemas.ts`
- Test: `tests/apiv1-response-schemas.test.ts`

**Interfaces:**
- One zod object per DTO, keys and nullability matching the serializer output exactly: `ProjectSchema`, `MilestoneSchema`, `TaskSchema`, `ApprovalSchema`, `ProjectDetailSchema` (= Project + `milestones[]`, `tasks[]`, `open_approvals[]`), `TicketSchema`, `MessageSchema`, `TicketDetailSchema` (Ticket + `messages[]`), `BriefSchema`, `FileSchema`, `DownloadSchema` (`{ url, name, size_bytes, expires_in_seconds }`), `InvoiceSchema`, `PaymentSchema`, `SubscriptionSchema`, `MeSchema`, `LeadSchema`, `ClientAdminSchema`, `ProposalSchema`, `EntitySchema` (loose: `z.object({ id: z.string(), created_at: z.string() }).passthrough()`), `AuditEventSchema`, `PageViewSchema`, `ServicesSchema` (`{ services[], appointment_types[] }`), `IndustrySchema`, `PlanSchema`, `StatusSchema`, `SlotsSchema`, `BookingCreatedSchema`, `LeadAcceptedSchema`, `WebhookEndpointSchema`, `WebhookEndpointWithSecretSchema`, `WebhookDeliverySchema`, `WebhookEventSchema`, `DeletedSchema` (`{ id, deleted: z.literal(true) }`), `QueuedSchema` (`{ queued: z.number() }`).
- `envelope(s)` → `z.object({ data: s })`; `listEnvelope(s)` → `z.object({ data: z.array(s), meta: z.object({ next_cursor: z.string().nullable(), limit: z.number() }) })`.
- `.meta({ example })` or `.describe()` on non-obvious fields is welcome but not required.

- [ ] **Step 1: Test** — for each of `toTicketDto`, `toProjectDto`, `toInvoiceDto`, `toLeadDto`, `toClientAdminDto`, `toEndpointDto`, `toDeliveryDto` (import from the serializer modules — all `@/`-free), build a realistic row (copy the fixtures from `tests/apiv1-serializers.test.ts` / `tests/apiv1-serializers-admin.test.ts` / `tests/webhooks-endpoints.test.ts`), serialise, and assert `Schema.safeParse(dto).success === true` AND that every key of the DTO appears in `Schema.shape` (catches a schema missing a field). Also `listEnvelope(TicketSchema).safeParse({ data: [], meta: { next_cursor: null, limit: 25 } }).success`.
- [ ] **Step 2–4: RED → implement → PASS; typecheck; lint.**
- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/response-schemas.ts tests/apiv1-response-schemas.test.ts
git commit -m "OpenAPI: zod response schemas for every DTO"
```

---

### Task 4: Route `meta.response` tightened (batch)

**Files:**
- Modify: every `app/api/v1/**/route.ts` except `openapi.json` — replace `response: z.any()` with the matching schema from Task 3 (`envelope(X)` / `listEnvelope(X)`); add `.meta({ example })` seeds to the REQUEST schemas of the curl-worthy operations (`createTicket`, `addTicketMessage`, `decideApproval`, `createLead` (admin), `submitLead`, `createWebhook`, `patchWebhook`, `createBookingHandler`'s `createBody`) by wrapping the existing zod objects — e.g. in `lib/apiv1/resources/tickets.ts`: `export const createBody = z.object({...}).meta({ example: { subject: "Login page returns 500", body: "Since 9am…", category: "bug", priority: "high" } })`.
- Test: `tests/apiv1-openapi-coverage.test.ts` (written here, extended in Task 5): imports the index, loads every module, and asserts every handler export has an `operationOf()` whose `meta.response` is NOT `z.any()` (detect via `response._zod?.def?.type !== "any"` — verify the zod v4 internal name by checking `z.any()._zod.def.type` in a REPL first, or compare `JSON.stringify(z.toJSONSchema(response)) !== "{}"`). Loading route modules pulls in `@/lib/apiv1/runtime` → Supabase etc.; mock `@/lib/supabase` (`getSupabase: () => null`, `isSupabaseConfigured: () => false`) and `server-only` is already mapped by the alias hook.

- [ ] **Step 1: Write the coverage test; RED (all `z.any()`).** **Step 2: Batch-edit the 45 route files + example seeds.** **Step 3: PASS; `npm test`; typecheck; lint; `npm run build`.**
- [ ] **Step 4: Commit**

```bash
git add app/api/v1 lib/apiv1/resources tests/apiv1-openapi-coverage.test.ts
git commit -m "OpenAPI: real response schemas and request examples on every v1 route"
```

---

### Task 5: OpenAPI builder

**Files:**
- Create: `lib/apiv1/json-schema.ts`, `lib/apiv1/openapi.ts`
- Test: `tests/apiv1-json-schema.test.ts`, `tests/apiv1-openapi.test.ts`, extend `tests/apiv1-openapi-coverage.test.ts`

**Interfaces:**
- `json-schema.ts` (pure, `@/`-free):
  - `zodToSchema(s: ZodType): Record<string, unknown>` — `z.toJSONSchema(s, { target: "openapi-3.0"? })` — use `{ unrepresentable: "any" }` so exotic types degrade to `{}` rather than throw; strip `$schema`.
  - `queryToParameters(s: ZodType | undefined): OpenApiParameter[]` — for a `ZodObject`, one `{ name, in: "query", required, schema, description? }` per shape key; `limit`/`cursor` become `$ref: "#/components/parameters/limit|cursor"`.
  - `pathParameters(path: string): OpenApiParameter[]` — `{name}` segments → `{ name, in: "path", required: true, schema: { type: "string", format: "uuid" } }`; `{entity}` → `enum` of the four entity names; `{did}` → uuid.
  - `exampleFor(s: ZodType): unknown` — `s.meta()?.example` if present, else `undefined`.
- `openapi.ts`:
  - `openApiForRoutes(routes: { path: string; module: Record<string, unknown> }[], opts: { version: string; serverUrl: string }): OpenApiDocument` — pure: for each route, for each export in `["GET","POST","PATCH","PUT","DELETE"]` with `operationOf(fn)`, emit the operation (tags, summary, operationId, `x-audience` from `auth` (`none`→`public`), `security`, `x-scopes`, `x-idempotent`, parameters (path + query + `Idempotency-Key` header when idempotent), `requestBody` from `body` with `example`, `responses`: `200`/`201`/`202` per what the handler returns is unknowable statically — use `200` for GET, `201` for POST create operations (operationId starts with `create`), `202` for `submitLead`/`testWebhook`, else `200`; plus `4XX`/`5XX` → `$ref Error`); `components.schemas.Error`; `components.parameters.limit/cursor`; `components.securitySchemes.bearerAuth`; `webhooks` from `EVENT_TYPES` (each: `post` with `x-rsg-signature`/`x-rsg-timestamp` header params and a request body `{ id, type, sequence, created_at, data: zodToSchema(EVENTS[t].dataSchema) }`, `x-audience`).
  - `buildOpenApi(): Promise<OpenApiDocument>` — memoised; `await Promise.all(V1_ROUTES.map(r => r.load()))` then `openApiForRoutes`.
  - Tag order for the page: `Account, Projects, Tickets, Briefs, Files, Billing, Webhooks, Admin, Public` — export `TAG_ORDER`.

- [ ] **Step 1: Tests**

```ts
// tests/apiv1-json-schema.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { exampleFor, pathParameters, queryToParameters, zodToSchema } from "../lib/apiv1/json-schema.ts";

describe("json-schema helpers", () => {
  it("converts zod and strips $schema", () => {
    const s = zodToSchema(z.object({ a: z.string().max(3), b: z.number().optional() }));
    assert.equal("$schema" in s, false); assert.deepEqual(s.required, ["a"]);
  });
  it("query → parameters with shared refs", () => {
    const p = queryToParameters(z.object({ status: z.enum(["open"]).optional(), limit: z.string().optional(), cursor: z.string().optional() }));
    assert.deepEqual(p.map((x) => x.name ?? x.$ref), ["status", "#/components/parameters/limit", "#/components/parameters/cursor"]);
    assert.equal((p[0] as { required: boolean }).required, false);
  });
  it("path params", () => {
    const p = pathParameters("/api/v1/admin/{entity}/{id}");
    assert.equal(p.length, 2); assert.deepEqual((p[0] as { schema: { enum: string[] } }).schema.enum, ["actions", "opportunities", "risks", "ideas"]);
    assert.equal((p[1] as { schema: { format: string } }).schema.format, "uuid");
  });
  it("examples", () => {
    assert.deepEqual(exampleFor(z.object({ a: z.string() }).meta({ example: { a: "x" } })), { a: "x" });
    assert.equal(exampleFor(z.object({})), undefined);
  });
});
```

```ts
// tests/apiv1-openapi.test.ts — pure core with two fake route modules
import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
mock.module("@/lib/supabase", { namedExports: { getSupabase: () => null, isSupabaseConfigured: () => false } });
const { withApi } = await import("../lib/apiv1/pipeline.ts");
const { openApiForRoutes } = await import("../lib/apiv1/openapi.ts");
const deps = { enabled: () => true, resolveKey: async () => null, resolvePrincipal: async () => null, rateLimit: async () => true, clientIp: () => "1.1.1.1", idempotency: null, usage: null };
const body = z.object({ subject: z.string() }).meta({ example: { subject: "x" } });
const GET = withApi("GET", { auth: "client", scopes: ["tickets:read"], query: z.object({ status: z.string().optional(), limit: z.string().optional() }), meta: { operationId: "listX", summary: "List", tag: "Tickets", response: z.object({ data: z.array(z.object({ id: z.string() })) }) } }, async () => ({ data: [] }), deps);
const POST = withApi("POST", { auth: "client", scopes: ["tickets:write"], idempotent: true, body, meta: { operationId: "createX", summary: "Create", tag: "Tickets", response: z.object({ data: z.object({ id: z.string() }) }) } }, async () => ({ data: {} }), deps);
const PUB = withApi("GET", { auth: "none", meta: { operationId: "getStatus", summary: "Status", tag: "Public", response: z.object({ data: z.object({ status: z.string() }) }) } }, async () => ({ data: {} }), deps);

describe("openApiForRoutes", () => {
  const doc = openApiForRoutes([{ path: "/api/v1/x", module: { GET, POST } }, { path: "/api/v1/x/{id}", module: { GET } }, { path: "/api/v1/public/status", module: { GET: PUB } }], { version: "1.2.3", serverUrl: "https://example.com" });
  it("has the required top-level shape", () => {
    assert.equal(doc.openapi, "3.1.0"); assert.equal(doc.info.version, "1.2.3"); assert.deepEqual(doc.servers, [{ url: "https://example.com" }]);
    assert.ok(doc.components.securitySchemes.bearerAuth); assert.ok(doc.components.schemas.Error); assert.ok(doc.components.parameters.limit);
  });
  it("emits operations with security, scopes, params, body example and error refs", () => {
    const get = doc.paths["/api/v1/x"].get; const post = doc.paths["/api/v1/x"].post;
    assert.equal(get.operationId, "listX"); assert.deepEqual(get.security, [{ bearerAuth: [] }]); assert.deepEqual(get["x-scopes"], ["tickets:read"]);
    assert.ok(get.parameters.some((p: { $ref?: string }) => p.$ref === "#/components/parameters/limit"));
    assert.equal(post["x-idempotent"], true); assert.ok(post.parameters.some((p: { name?: string }) => p.name === "Idempotency-Key"));
    assert.deepEqual(post.requestBody.content["application/json"].example, { subject: "x" });
    assert.ok(post.responses["201"]); assert.equal(post.responses["4XX"].content["application/json"].schema.$ref, "#/components/schemas/Error");
    assert.equal(doc.paths["/api/v1/x/{id}"].get.parameters[0].name, "id");
    const pub = doc.paths["/api/v1/public/status"].get; assert.equal(pub["x-audience"], "public"); assert.equal(pub.security, undefined);
  });
  it("documents webhooks from the catalog", () => {
    assert.ok(doc.webhooks["ticket.created"].post); assert.ok(doc.webhooks.ping.post.requestBody);
    assert.ok(doc.webhooks["ticket.created"].post.parameters.some((p: { name: string }) => p.name === "x-rsg-signature"));
  });
});
```

  Extend `tests/apiv1-openapi-coverage.test.ts`: build via `buildOpenApi()` (real routes, Supabase mocked) and assert (a) every handler export of every module has an operation in `doc.paths[path][method]`; (b) `operationId`s are unique; (c) every `$ref` in the document resolves against `components`; (d) for every operation with `requestBody.content["application/json"].example`, `operationOf(fn).body.safeParse(example).success` — every example validates against its own schema.

- [ ] **Step 2–4: RED → implement → PASS (`node --experimental-test-module-mocks --test tests/apiv1-json-schema.test.ts tests/apiv1-openapi.test.ts tests/apiv1-openapi-coverage.test.ts`); typecheck; lint.**
- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/json-schema.ts lib/apiv1/openapi.ts tests/apiv1-json-schema.test.ts tests/apiv1-openapi.test.ts tests/apiv1-openapi-coverage.test.ts
git commit -m "OpenAPI: build the 3.1 document from registered operations and the event catalog"
```

---

### Task 6: `GET /api/v1/openapi.json`

**Files:**
- Create: `app/api/v1/openapi.json/route.ts`
- Modify: `scripts/gen-v1-index.mjs` already skips it (Task 2); `middleware.ts` needs no change (GET).

```ts
import { NextResponse } from "next/server";
import { apiPlatformEnabled } from "@/lib/env";
import { buildOpenApi } from "@/lib/apiv1/openapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!apiPlatformEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const doc = await buildOpenApi();
  return NextResponse.json(doc, { headers: { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" } });
}
```

- [ ] **Step 1: Implement; `npm run typecheck && npm run lint && npm run build`.** **Step 2: dev server (flag on): `curl -s localhost:3123/api/v1/openapi.json | python -c "import sys,json; d=json.load(sys.stdin); print(d['openapi'], len(d['paths']), len(d['webhooks']))"` → `3.1.0 45 23`; flag off → 404. Kill the server.**
- [ ] **Step 3: Commit**

```bash
git add app/api/v1/openapi.json
git commit -m "OpenAPI: serve /api/v1/openapi.json"
```

---

### Task 7: `/developers` page

**Files:**
- Create: `lib/developers/content.ts` (prose: Getting started, Authentication, Errors, Pagination, Idempotency, Rate limits, Webhooks — each a `{ id, title, body: string[] }` with paragraphs; lift the wording from `docs/api-platform.md`, trimmed), `components/developers/DeveloperDocs.tsx` (layout: sticky left rail `<nav aria-label="API reference">` with the prose sections then one entry per tag; main column), `components/developers/OperationBlock.tsx` (method badge, path in `font-mono`, summary, audience/scopes chips, parameters table, request schema + example, response schema, a `curl` example), `components/developers/SchemaView.tsx` (renders a JSON-Schema object as a nested `<dl>`: name · type · required · description; arrays and `$ref` resolved from `components.schemas`), `components/developers/CodeBlock.tsx` (`<pre>` with `overflow-x-auto`), `app/(marketing)/developers/page.tsx`.
- Modify: `scripts/audit-responsive.mjs` (`PUBLIC_ROUTES` += `/developers`), `app/sitemap.ts` (add `/developers` only when the flag is on — read how it builds entries).

**Behaviour:**
- Page is a server component: `if (!apiPlatformEnabled()) notFound();` then `const doc = await buildOpenApi();` and render. `metadata`: title "API reference | Redmont Strategies Group", `robots: { index: true }`, canonical `/developers`.
- curl example per operation: method, `https://<server>/<path with {id} → 11111111-…>`, `-H "Authorization: Bearer rsg_live_…"` when secured, `-H "Idempotency-Key: <uuid>"` when idempotent, `-H "Content-Type: application/json" -d '<example JSON>'` when a body example exists; keyless routes omit the auth header.
- Use the site's existing type scale/classes (`label`, `display`, `container-px`, `font-mono`, `tracking-label`, `text-white/…` — copy from `app/(marketing)/privacy/page.tsx`). Anchor ids on every section and operation (`#op-createTicket`). Responsive: the rail collapses above the content below `lg`; tables/code scroll inside their own container; body never scrolls horizontally.
- "Download OpenAPI" link → `/api/v1/openapi.json`.

- [ ] **Step 1: Implement.** **Step 2: `npm run typecheck && npm run lint && npm test && npm run build`.** **Step 3: dev server (flag on): `curl -s -o /dev/null -w "%{http_code}" localhost:3123/developers` → 200; count `id="op-"` anchors in the HTML equals the number of operations in `openapi.json`; flag off → 404. Then `npm run audit:responsive -- --routes=/developers` → 0 clipped, 0 tap-target failures (fix and re-run until clean). Kill the server.**
- [ ] **Step 4: Commit**

```bash
git add lib/developers app/\(marketing\)/developers components/developers scripts/audit-responsive.mjs app/sitemap.ts
git commit -m "Developers: public API reference page rendered from the OpenAPI document"
```

---

### Task 8: Docs, `.env.example`, final verification

- [ ] **Step 1:** `docs/api-platform.md`: add an "OpenAPI & reference" section (the two URLs, the `npm run gen:v1-index` rule and the CI guardrails, how to add an operation so it documents itself: `meta` + a real `response` schema + an `example` on the body); update `.env.example`'s `API_PLATFORM_ENABLED` comment to mention `/developers` and `openapi.json` are gated too. Keep ≤ 320 lines.
- [ ] **Step 2:** `npm test && npm run typecheck && npm run lint && npm run build` — paste totals.
- [ ] **Step 3: Commit**

```bash
git add docs/api-platform.md .env.example
git commit -m "Docs: OpenAPI and developer reference"
```

Then stop — the controller runs the final whole-branch review before any PR.
