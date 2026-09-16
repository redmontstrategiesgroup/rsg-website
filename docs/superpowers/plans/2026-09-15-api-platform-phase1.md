# API Platform — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `/api/v1` core — API keys for clients and admins, the `withApi` request pipeline (auth, scopes, rate limit, idempotency, validation, envelope, usage log), key-management routes + UI, and every client-scoped resource — behind the `API_PLATFORM_ENABLED` flag.

**Architecture:** A new route tree `Website/app/api/v1/**` whose handlers are thin wrappers around a single `withApi()` pipeline in `Website/lib/apiv1/`. Pipeline modules are pure and take their I/O as injected `deps` so they are unit-testable with fake Supabase builders; `lib/apiv1/runtime.ts` wires the real deps once. Handlers call the existing `lib/lifecycle/*` and `lib/store` functions and return DTOs from `lib/apiv1/serializers.ts`, never raw rows.

**Tech Stack:** Next.js 15 route handlers (`runtime = "nodejs"`), zod 4, Supabase service-role client, `@upstash/ratelimit` via `lib/security`, `node --test` with fake query builders (pattern: `tests/privacy-erase.test.ts`, alias hook: `tests/webhooks.test.ts`).

**Spec:** `docs/superpowers/specs/2026-09-15-api-platform-design.md` — Phase 1 covers §1, §2, §3.1, the paged lib functions from §3.4, the `api_*` tables and `webhook_endpoints` columns from §4.1 (schema only), and the cron cleanup from §7.

## Global Constraints

- All paths below are relative to the Website repo root (this repo). `docs/` paths are also in this repo.
- The lib directory is `lib/apiv1/` (not `lib/api/` — `lib/api.ts` already exists and would shadow a directory index).
- Every `lib/apiv1/*.ts` module that a test imports must use **relative** imports only (`../security`, `../lifecycle/types`), never `@/`. Only `lib/apiv1/runtime.ts`, resource modules under `lib/apiv1/resources/`, and route files may use `@/`.
- Every v1 route file: `export const runtime = "nodejs"; export const dynamic = "force-dynamic";`.
- Key format: `rsg_live_` + 32 base62 chars; `key_prefix` = first 8 chars after the prefix; `key_hash` = hex sha256 of the full plaintext.
- Error codes (exact strings): `unauthenticated`, `insufficient_scope`, `not_found`, `validation_failed`, `rate_limited`, `idempotency_required`, `idempotency_mismatch`, `conflict`, `unavailable`, `internal`.
- Envelope: success `{ data }` / lists `{ data, meta: { next_cursor, limit } }`; error `{ error: { code, message, details?, correlation_id } }`.
- Pagination: `limit` 1–100 default 25; cursor = base64url JSON `[created_at, id]`; order `created_at desc, id desc`.
- Rate limits: keyed `api:key:<id>` 600/10 min; keyless `api:ip:<ip>` 60/10 min.
- Ownership failures return 404 `not_found`, never 403.
- Feature flag: `process.env.API_PLATFORM_ENABLED === "true"`; off → 503 `unavailable` on every v1 route and key-management UI hidden.
- Tests: `node --test tests/<file>.test.ts` (Node 24 strips types natively). Full suite `npm test`; then `npm run typecheck && npm run lint`.
- Commit after every task with the message shown; end every commit message with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Work on branch `feat/api-platform` created from `main` (Task 0).

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20260915120000_api_platform.sql` | `api_keys`, `api_idempotency`, `api_requests`, `leads.deleted_at`, `briefs.client_id`, `webhook_endpoints` columns |
| `lib/apiv1/paths.ts` | `isApiV1Path()` — the one rule middleware needs |
| `lib/apiv1/errors.ts` | `ApiError`, `ErrorCode`, `errorBody()` |
| `lib/apiv1/pagination.ts` | cursor codec, `parseListParams`, `applyCursor`, `pageResult` |
| `lib/apiv1/scopes.ts` | scope vocab, admin scope→permission map, `capAdminScopes` |
| `lib/apiv1/keys.ts` | `generateApiKey`, `hashApiKey`, `resolveApiKey` |
| `lib/apiv1/principal.ts` | `Principal` type, `resolvePrincipal` |
| `lib/apiv1/idempotency.ts` | `requestHash`, `beginIdempotent`, `completeIdempotent` |
| `lib/apiv1/usage.ts` | `recordUsage`, `templatePath` |
| `lib/apiv1/registry.ts` | operation `meta` registry (consumed by Phase 4) |
| `lib/apiv1/pipeline.ts` | `withApi(config, handler, deps)` |
| `lib/apiv1/runtime.ts` | real deps + `api()` helper used by routes |
| `lib/apiv1/serializers.ts` | DTOs + `DENYLIST` |
| `lib/apiv1/ownership.ts` | pure "does X belong to client" guards |
| `lib/apiv1/key-store.ts` | create/list/revoke keys, 30-day counts |
| `lib/lifecycle/paged.ts` | cursor-paged list functions for projects/tickets/files/invoices/briefs |
| `app/api/v1/**` | routes (§3.1) |
| `app/api/portal/apikeys/**`, `app/api/admin/apikeys/**` | cookie-auth key management |
| `components/portal/ApiKeysView.tsx`, `app/portal/developers/page.tsx` | portal UI |
| `components/admin/ApiKeysAdminPanel.tsx` | admin tab |
| `tests/apiv1-*.test.ts`, `tests/_alias-hook.ts` | tests |

---

### Task 0: Branch

- [ ] **Step 1: Create the branch from main**

```bash
cd /c/Users/josep/Desktop/RSG
git switch main && git pull --ff-only
git switch -c feat/api-platform
```

Expected: `Switched to a new branch 'feat/api-platform'`.

---

### Task 1: Migration, feature flag, middleware bypass

**Files:**
- Create: `supabase/migrations/20260915120000_api_platform.sql`
- Create: `lib/apiv1/paths.ts`
- Modify: `lib/env.ts` (append)
- Modify: `middleware.ts:155-171` (the exemption block)
- Test: `tests/apiv1-paths.test.ts`

**Interfaces:**
- Produces: `isApiV1Path(pathname: string): boolean`; `apiPlatformEnabled(): boolean` (in `lib/env.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/apiv1-paths.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isApiV1Path } from "../lib/apiv1/paths.ts";

describe("isApiV1Path", () => {
  it("matches the v1 tree only", () => {
    assert.equal(isApiV1Path("/api/v1/me"), true);
    assert.equal(isApiV1Path("/api/v1/openapi.json"), true);
    assert.equal(isApiV1Path("/api/v1"), true);
    assert.equal(isApiV1Path("/api/v10/x"), false);
    assert.equal(isApiV1Path("/api/portal/apikeys"), false);
    assert.equal(isApiV1Path("/v1/me"), false);
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `node --test tests/apiv1-paths.test.ts`
Expected: FAIL — cannot find module `../lib/apiv1/paths.ts`.

- [ ] **Step 3: Implement**

```ts
// lib/apiv1/paths.ts
/**
 * The public API tree. Middleware skips browser-only checks (bot UA,
 * fetch-metadata, Origin, CSRF) here because bearer auth replaces them.
 * Edge-safe: no imports.
 */
export function isApiV1Path(pathname: string): boolean {
  return pathname === "/api/v1" || pathname.startsWith("/api/v1/");
}
```

Append to `lib/env.ts`:

```ts
/** Public API (/api/v1) is dark until this is "true" in the environment. */
export function apiPlatformEnabled(): boolean {
  return process.env.API_PLATFORM_ENABLED === "true";
}
```

In `middleware.ts`, add the import at the top (edge-safe, no deps):

```ts
import { isApiV1Path } from "@/lib/apiv1/paths";
```

and inside `if (pathname.startsWith("/api/") && MUTATING_METHODS.has(request.method)) {`, before the `/api/briefs/ingest` check, add:

```ts
    // Public API: bearer-key authentication in the route handler (lib/apiv1)
    // replaces browser CSRF / user-agent checks. See spec §2.9.
    if (isApiV1Path(pathname)) {
      return forward();
    }
```

Create the migration:

```sql
-- supabase/migrations/20260915120000_api_platform.sql
-- API platform (spec: docs/superpowers/specs/2026-09-15-api-platform-design.md)
-- One migration for all four phases so later phases need no schema change.

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  principal_type text not null check (principal_type in ('client','admin')),
  principal_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null,
  created_by text not null,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists api_keys_principal_idx
  on public.api_keys (principal_type, principal_id) where revoked_at is null;
alter table public.api_keys enable row level security;

create table if not exists public.api_idempotency (
  principal_id uuid not null,
  key text not null,
  request_hash text not null,
  status text not null check (status in ('in_flight','done')),
  response_status int,
  response_body jsonb,
  created_at timestamptz not null default now(),
  primary key (principal_id, key)
);
create index if not exists api_idempotency_created_idx on public.api_idempotency (created_at);
alter table public.api_idempotency enable row level security;

create table if not exists public.api_requests (
  id bigint generated always as identity primary key,
  key_id uuid,
  principal_type text,
  principal_id uuid,
  method text not null,
  path text not null,
  status int not null,
  duration_ms int not null,
  ip text,
  correlation_id text,
  created_at timestamptz not null default now()
);
create index if not exists api_requests_key_created_idx
  on public.api_requests (key_id, created_at desc);
create index if not exists api_requests_created_idx on public.api_requests (created_at);
alter table public.api_requests enable row level security;

-- Soft delete for leads (admin API, Phase 2).
alter table public.leads add column if not exists deleted_at timestamptz;

-- Briefs submitted by / for a client through the client API. Executive briefs
-- created by RSG keep null.
alter table public.briefs add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists briefs_client_idx on public.briefs (client_id, created_at desc)
  where client_id is not null;

-- Webhook ownership + subscriptions (Phase 3 uses these; schema lands now).
alter table public.webhook_endpoints
  add column if not exists owner_type text check (owner_type in ('client','admin')),
  add column if not exists owner_id uuid,
  add column if not exists events text[] not null default '{}',
  add column if not exists api_key_id uuid references public.api_keys(id) on delete set null,
  add column if not exists disabled_at timestamptz,
  add column if not exists failure_count int not null default 0;
create index if not exists webhook_endpoints_owner_idx
  on public.webhook_endpoints (owner_type, owner_id) where disabled_at is null;
```

- [ ] **Step 4: Run test + typecheck**

Run: `node --test tests/apiv1-paths.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Apply the migration to the live project**

Use the Supabase MCP `apply_migration` tool against project `dyajmgddsiqcnlehqbhl` with name `api_platform` and the SQL above. Then `list_tables` and confirm `api_keys`, `api_idempotency`, `api_requests` exist. If MCP is unavailable, stop and report — do not skip.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260915120000_api_platform.sql lib/apiv1/paths.ts lib/env.ts middleware.ts tests/apiv1-paths.test.ts
git commit -m "API platform: schema, feature flag, middleware bypass for /api/v1"
```

---

### Task 2: Errors and envelope

**Files:**
- Create: `lib/apiv1/errors.ts`
- Test: `tests/apiv1-errors.test.ts`

**Interfaces:**
- Produces:
  - `type ErrorCode = "unauthenticated" | "insufficient_scope" | "not_found" | "validation_failed" | "rate_limited" | "idempotency_required" | "idempotency_mismatch" | "conflict" | "unavailable" | "internal"`
  - `class ApiError extends Error { status: number; code: ErrorCode; details?: unknown }` constructed as `new ApiError(status, code, message, details?)`
  - `notFound(message = "Not found.")` → `ApiError(404, "not_found", …)`
  - `errorBody(err: ApiError, correlationId: string)` → `{ error: { code, message, details?, correlation_id } }`
  - `toApiError(err: unknown)` → `ApiError` (passes `ApiError` through; anything else → 500 `internal`, message "Something went wrong.")

- [ ] **Step 1: Write the failing test**

```ts
// tests/apiv1-errors.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError, errorBody, notFound, toApiError } from "../lib/apiv1/errors.ts";

describe("ApiError", () => {
  it("carries status, code, details", () => {
    const e = new ApiError(422, "validation_failed", "Bad input.", { field: ["x"] });
    assert.equal(e.status, 422);
    assert.equal(e.code, "validation_failed");
    assert.deepEqual(errorBody(e, "c-1"), {
      error: { code: "validation_failed", message: "Bad input.", details: { field: ["x"] }, correlation_id: "c-1" },
    });
  });
  it("omits details when absent", () => {
    assert.deepEqual(errorBody(notFound(), "c"), {
      error: { code: "not_found", message: "Not found.", correlation_id: "c" },
    });
  });
  it("wraps unknown errors as internal without leaking the message", () => {
    const e = toApiError(new Error("pg: relation missing"));
    assert.equal(e.status, 500);
    assert.equal(e.code, "internal");
    assert.equal(e.message, "Something went wrong.");
    const passthrough = new ApiError(409, "conflict", "x");
    assert.equal(toApiError(passthrough), passthrough);
  });
});
```

- [ ] **Step 2: Run — expect failure** (`node --test tests/apiv1-errors.test.ts`, module not found).

- [ ] **Step 3: Implement**

```ts
// lib/apiv1/errors.ts
export type ErrorCode =
  | "unauthenticated" | "insufficient_scope" | "not_found" | "validation_failed"
  | "rate_limited" | "idempotency_required" | "idempotency_mismatch"
  | "conflict" | "unavailable" | "internal";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function notFound(message = "Not found."): ApiError {
  return new ApiError(404, "not_found", message);
}

export function errorBody(err: ApiError, correlationId: string) {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details === undefined ? {} : { details: err.details }),
      correlation_id: correlationId,
    },
  };
}

/** Anything that is not already an ApiError becomes an opaque 500. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError(500, "internal", "Something went wrong.");
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/errors.ts tests/apiv1-errors.test.ts
git commit -m "API platform: ApiError and error envelope"
```

---

### Task 3: Cursor pagination

**Files:**
- Create: `lib/apiv1/pagination.ts`
- Test: `tests/apiv1-pagination.test.ts`

**Interfaces:**
- Produces:
  - `type Cursor = { createdAt: string; id: string }`
  - `encodeCursor(c: Cursor): string`, `decodeCursor(s: string): Cursor | null`
  - `parseListParams(sp: URLSearchParams): { limit: number; cursor: Cursor | null }` — throws `ApiError(422,"validation_failed")` on a malformed cursor; clamps limit to 1–100, default 25, non-numeric → 25.
  - `applyCursor<Q extends CursorQuery>(query: Q, cursor: Cursor | null): Q` where `CursorQuery = { or(filter: string): any }` — applies `created_at.lt.<ts>,and(created_at.eq.<ts>,id.lt.<id>)`.
  - `pageResult<T extends { created_at: string; id: string }>(rows: T[], limit: number): { data: T[]; next_cursor: string | null }` — callers fetch `limit + 1`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/apiv1-pagination.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyCursor, decodeCursor, encodeCursor, pageResult, parseListParams } from "../lib/apiv1/pagination.ts";

describe("cursor codec", () => {
  it("round-trips", () => {
    const c = { createdAt: "2026-09-15T00:00:00.000Z", id: "11111111-1111-1111-1111-111111111111" };
    assert.deepEqual(decodeCursor(encodeCursor(c)), c);
  });
  it("rejects garbage", () => {
    assert.equal(decodeCursor("!!!"), null);
    assert.equal(decodeCursor(Buffer.from('{"a":1}').toString("base64url")), null);
  });
});

describe("parseListParams", () => {
  it("clamps and defaults", () => {
    assert.equal(parseListParams(new URLSearchParams("")).limit, 25);
    assert.equal(parseListParams(new URLSearchParams("limit=0")).limit, 1);
    assert.equal(parseListParams(new URLSearchParams("limit=500")).limit, 100);
    assert.equal(parseListParams(new URLSearchParams("limit=abc")).limit, 25);
  });
  it("throws validation_failed on a bad cursor", () => {
    assert.throws(() => parseListParams(new URLSearchParams("cursor=nope")), (e: any) => e.code === "validation_failed" && e.status === 422);
  });
});

describe("applyCursor / pageResult", () => {
  it("applies the keyset filter", () => {
    const calls: string[] = [];
    const q = { or: (f: string) => { calls.push(f); return q; } };
    applyCursor(q, { createdAt: "T", id: "I" });
    assert.deepEqual(calls, ["created_at.lt.T,and(created_at.eq.T,id.lt.I)"]);
    applyCursor(q, null);
    assert.equal(calls.length, 1);
  });
  it("trims to limit and emits next_cursor from the last kept row", () => {
    const rows = [1, 2, 3].map((n) => ({ id: `id${n}`, created_at: `t${n}` }));
    const r = pageResult(rows, 2);
    assert.equal(r.data.length, 2);
    assert.deepEqual(decodeCursor(r.next_cursor!), { createdAt: "t2", id: "id2" });
    assert.equal(pageResult(rows, 3).next_cursor, null);
  });
});
```

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement**

```ts
// lib/apiv1/pagination.ts
import { ApiError } from "./errors";

export type Cursor = { createdAt: string; id: string };

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify([c.createdAt, c.id])).toString("base64url");
}

export function decodeCursor(s: string): Cursor | null {
  try {
    const v = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    if (!Array.isArray(v) || v.length !== 2) return null;
    const [createdAt, id] = v;
    if (typeof createdAt !== "string" || typeof id !== "string" || !createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export function parseListParams(sp: URLSearchParams): { limit: number; cursor: Cursor | null } {
  const raw = Number(sp.get("limit"));
  const limit = Number.isFinite(raw) && raw !== 0 ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(raw))) : raw === 0 ? 1 : DEFAULT_LIMIT;
  const cs = sp.get("cursor");
  if (!cs) return { limit, cursor: null };
  const cursor = decodeCursor(cs);
  if (!cursor) throw new ApiError(422, "validation_failed", "Invalid cursor.", { cursor: ["malformed"] });
  return { limit, cursor };
}

export type CursorQuery = { or(filter: string): unknown };

/** Keyset predicate for `order by created_at desc, id desc`. */
export function applyCursor<Q extends CursorQuery>(query: Q, cursor: Cursor | null): Q {
  if (!cursor) return query;
  return query.or(
    `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
  ) as Q;
}

export function pageResult<T extends { created_at: string; id: string }>(
  rows: T[],
  limit: number,
): { data: T[]; next_cursor: string | null } {
  const data = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = data[data.length - 1];
  return { data, next_cursor: hasMore && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null };
}
```

Note on `limit=0`: the expression above maps `0` → `1` explicitly (the test requires it); `limit=abc` → `NaN` → default 25.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/pagination.ts tests/apiv1-pagination.test.ts
git commit -m "API platform: cursor pagination helpers"
```

---

### Task 4: Scopes

**Files:**
- Create: `lib/apiv1/scopes.ts`
- Test: `tests/apiv1-scopes.test.ts`

**Interfaces:**
- Consumes: `can(permission, role)` and `SchedulingRole`, `SchedulingPermission` from `../scheduling/permissions`.
- Produces:
  - `CLIENT_SCOPES` (readonly tuple) = `projects:read projects:write tickets:read tickets:write briefs:read briefs:write files:read billing:read webhooks:manage`
  - `ADMIN_SCOPES` = `leads:read leads:write clients:read proposals:read dashboard:read dashboard:write audit:read analytics:read webhooks:manage`
  - `type ClientScope`, `type AdminScope`, `type Scope = ClientScope | AdminScope`
  - `ADMIN_SCOPE_PERMISSION: Record<AdminScope, SchedulingPermission | null>` (null = any admin)
  - `isClientScope(s: string): s is ClientScope`, `isAdminScope(s: string): s is AdminScope`
  - `scopesAllowedFor(role: SchedulingRole): AdminScope[]`
  - `capAdminScopes(requested: string[], role: SchedulingRole): { allowed: AdminScope[]; rejected: string[] }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/apiv1-scopes.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { capAdminScopes, isAdminScope, isClientScope, scopesAllowedFor, ADMIN_SCOPES, CLIENT_SCOPES } from "../lib/apiv1/scopes.ts";

describe("scopes", () => {
  it("classifies", () => {
    assert.equal(isClientScope("projects:read"), true);
    assert.equal(isClientScope("leads:read"), false);
    assert.equal(isAdminScope("leads:read"), true);
    assert.equal(isAdminScope("webhooks:manage"), true);
    assert.equal(isClientScope("webhooks:manage"), true);
    assert.equal(CLIENT_SCOPES.length, 9);
    assert.equal(ADMIN_SCOPES.length, 9);
  });
  it("owner gets every admin scope", () => {
    assert.deepEqual([...scopesAllowedFor("owner")].sort(), [...ADMIN_SCOPES].sort());
  });
  it("caps by role permissions", () => {
    // 'scheduler' has no manage_leads / view_audit in ROLE_PERMISSIONS.
    const r = capAdminScopes(["leads:read", "webhooks:manage", "bogus"], "scheduler");
    assert.deepEqual(r.allowed, ["webhooks:manage"]);
    assert.deepEqual(r.rejected, ["leads:read", "bogus"]);
  });
});
```

Before writing, confirm the role assumption: `grep -n "scheduler" -A 12 lib/scheduling/permissions.ts`. If `scheduler` has `manage_leads`, pick a role that lacks it (e.g. `employee`) and adjust the test.

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement**

```ts
// lib/apiv1/scopes.ts
import { can, type SchedulingPermission, type SchedulingRole } from "../scheduling/permissions";

export const CLIENT_SCOPES = [
  "projects:read", "projects:write", "tickets:read", "tickets:write",
  "briefs:read", "briefs:write", "files:read", "billing:read", "webhooks:manage",
] as const;
export type ClientScope = (typeof CLIENT_SCOPES)[number];

export const ADMIN_SCOPES = [
  "leads:read", "leads:write", "clients:read", "proposals:read",
  "dashboard:read", "dashboard:write", "audit:read", "analytics:read", "webhooks:manage",
] as const;
export type AdminScope = (typeof ADMIN_SCOPES)[number];
export type Scope = ClientScope | AdminScope;

/** Spec §1.4. null = any admin may hold it. */
export const ADMIN_SCOPE_PERMISSION: Record<AdminScope, SchedulingPermission | null> = {
  "leads:read": "manage_leads",
  "leads:write": "manage_leads",
  "clients:read": "manage_clients",
  "proposals:read": "manage_clients",
  "dashboard:read": "manage_leads",
  "dashboard:write": "manage_leads",
  "audit:read": "view_audit",
  "analytics:read": "view_analytics",
  "webhooks:manage": null,
};

export function isClientScope(s: string): s is ClientScope {
  return (CLIENT_SCOPES as readonly string[]).includes(s);
}
export function isAdminScope(s: string): s is AdminScope {
  return (ADMIN_SCOPES as readonly string[]).includes(s);
}

export function scopesAllowedFor(role: SchedulingRole): AdminScope[] {
  return ADMIN_SCOPES.filter((s) => {
    const p = ADMIN_SCOPE_PERMISSION[s];
    return p === null || can(p, role);
  });
}

export function capAdminScopes(requested: string[], role: SchedulingRole): { allowed: AdminScope[]; rejected: string[] } {
  const allowedSet = new Set(scopesAllowedFor(role));
  const allowed: AdminScope[] = [];
  const rejected: string[] = [];
  for (const s of requested) {
    if (isAdminScope(s) && allowedSet.has(s)) allowed.push(s);
    else rejected.push(s);
  }
  return { allowed, rejected };
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/scopes.ts tests/apiv1-scopes.test.ts
git commit -m "API platform: scope vocabulary and admin permission cap"
```

---

### Task 5: Key generation and resolution

**Files:**
- Create: `lib/apiv1/keys.ts`
- Test: `tests/apiv1-keys.test.ts`

**Interfaces:**
- Produces:
  - `KEY_PREFIX = "rsg_live_"`
  - `generateApiKey(): { plaintext: string; prefix: string; hash: string }`
  - `hashApiKey(plaintext: string): string` (hex sha256)
  - `parseBearer(header: string | null): string | null` — returns the token after `Bearer ` (case-insensitive scheme), trimmed, or null
  - `type ApiKeyRow = { id: string; principal_type: "client" | "admin"; principal_id: string; name: string; key_prefix: string; scopes: string[]; created_by: string; last_used_at: string | null; expires_at: string | null; revoked_at: string | null; created_at: string }`
  - `type KeyDeps = { findByHash(hash: string): Promise<ApiKeyRow | null>; touch(id: string): Promise<void>; now?: () => number }`
  - `resolveApiKey(bearer: string | null, deps: KeyDeps): Promise<ApiKeyRow | null>` — null when missing, malformed (no `rsg_live_` prefix or wrong length), unknown, revoked, or expired. Calls `deps.touch(id)` at most once per 60 s per key id (module-level `Map<string, number>`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/apiv1-keys.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateApiKey, hashApiKey, parseBearer, resolveApiKey, KEY_PREFIX, type ApiKeyRow } from "../lib/apiv1/keys.ts";

const row = (over: Partial<ApiKeyRow> = {}): ApiKeyRow => ({
  id: "k1", principal_type: "client", principal_id: "c1", name: "n", key_prefix: "abcdefgh",
  scopes: ["projects:read"], created_by: "a@b.c", last_used_at: null, expires_at: null, revoked_at: null,
  created_at: "2026-01-01T00:00:00Z", ...over,
});

describe("generateApiKey", () => {
  it("has the documented shape", () => {
    const k = generateApiKey();
    assert.ok(k.plaintext.startsWith(KEY_PREFIX));
    assert.equal(k.plaintext.length, KEY_PREFIX.length + 32);
    assert.match(k.plaintext.slice(KEY_PREFIX.length), /^[0-9A-Za-z]{32}$/);
    assert.equal(k.prefix, k.plaintext.slice(KEY_PREFIX.length, KEY_PREFIX.length + 8));
    assert.equal(k.hash, hashApiKey(k.plaintext));
    assert.match(k.hash, /^[0-9a-f]{64}$/);
    assert.notEqual(generateApiKey().plaintext, k.plaintext);
  });
});

describe("parseBearer", () => {
  it("extracts the token", () => {
    assert.equal(parseBearer("Bearer abc"), "abc");
    assert.equal(parseBearer("bearer  abc "), "abc");
    assert.equal(parseBearer("Basic abc"), null);
    assert.equal(parseBearer(null), null);
  });
});

describe("resolveApiKey", () => {
  const k = generateApiKey();
  const mk = (r: ApiKeyRow | null) => {
    const touched: string[] = [];
    let t = 1_000_000;
    return {
      touched,
      deps: { findByHash: async (h: string) => (r && h === k.hash ? r : null), touch: async (id: string) => { touched.push(id); }, now: () => t },
      advance: (ms: number) => { t += ms; },
    };
  };
  it("resolves a live key and touches it once per minute", async () => {
    const f = mk(row({ id: "live-" + Math.random() }));
    const r1 = await resolveApiKey(k.plaintext, f.deps);
    assert.ok(r1);
    await resolveApiKey(k.plaintext, f.deps);
    assert.equal(f.touched.length, 1);
    f.advance(61_000);
    await resolveApiKey(k.plaintext, f.deps);
    assert.equal(f.touched.length, 2);
  });
  it("rejects malformed, unknown, revoked, expired", async () => {
    assert.equal(await resolveApiKey("nope", mk(row()).deps), null);
    assert.equal(await resolveApiKey(KEY_PREFIX + "x".repeat(32), mk(row()).deps), null);
    assert.equal(await resolveApiKey(k.plaintext, mk(null).deps), null);
    assert.equal(await resolveApiKey(k.plaintext, mk(row({ revoked_at: "2026-01-02T00:00:00Z" })).deps), null);
    assert.equal(await resolveApiKey(k.plaintext, mk(row({ expires_at: "2000-01-01T00:00:00Z" })).deps), null);
  });
});
```

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement**

```ts
// lib/apiv1/keys.ts
import { createHash, randomBytes } from "node:crypto";

export const KEY_PREFIX = "rsg_live_";
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BODY_LENGTH = 32;
const TOUCH_INTERVAL_MS = 60_000;

export type ApiKeyRow = {
  id: string;
  principal_type: "client" | "admin";
  principal_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_by: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function generateApiKey(): { plaintext: string; prefix: string; hash: string } {
  const bytes = randomBytes(BODY_LENGTH);
  let body = "";
  for (let i = 0; i < BODY_LENGTH; i++) body += ALPHABET[bytes[i]! % ALPHABET.length];
  const plaintext = KEY_PREFIX + body;
  return { plaintext, prefix: body.slice(0, 8), hash: hashApiKey(plaintext) };
}

export function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^bearer\s+(.+)$/i.exec(header.trim());
  const token = m?.[1]?.trim();
  return token ? token : null;
}

export type KeyDeps = {
  findByHash(hash: string): Promise<ApiKeyRow | null>;
  touch(id: string): Promise<void>;
  now?: () => number;
};

const lastTouched = new Map<string, number>();

export async function resolveApiKey(bearer: string | null, deps: KeyDeps): Promise<ApiKeyRow | null> {
  if (!bearer || !bearer.startsWith(KEY_PREFIX) || bearer.length !== KEY_PREFIX.length + BODY_LENGTH) return null;
  const row = await deps.findByHash(hashApiKey(bearer));
  if (!row) return null;
  const now = deps.now ? deps.now() : Date.now();
  if (row.revoked_at) return null;
  if (row.expires_at && Date.parse(row.expires_at) <= now) return null;
  const prev = lastTouched.get(row.id) ?? 0;
  if (now - prev >= TOUCH_INTERVAL_MS) {
    lastTouched.set(row.id, now);
    deps.touch(row.id).catch(() => { /* best effort */ });
  }
  return row;
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/keys.ts tests/apiv1-keys.test.ts
git commit -m "API platform: key generation, hashing, bearer resolution"
```

---

### Task 6: Principal resolution

**Files:**
- Create: `lib/apiv1/principal.ts`
- Test: `tests/apiv1-principal.test.ts`

**Interfaces:**
- Consumes: `ApiKeyRow` (Task 5), `scopesAllowedFor` (Task 4), `PortalContext` from `../lifecycle/access` (type-only import), `SchedulingRole`.
- Produces:
  - `type ClientPrincipal = { type: "client"; keyId: string; keyName: string; scopes: string[]; portal: PortalContext }`
  - `type AdminPrincipal = { type: "admin"; keyId: string; keyName: string; scopes: string[]; adminId: string; email: string; role: SchedulingRole }`
  - `type Principal = ClientPrincipal | AdminPrincipal`
  - `type PrincipalDeps = { getClient(id: string): Promise<{ id: string; name: string; company: string; email: string; status: string } | null>; getAdmin(id: string): Promise<{ id: string; email: string; role: SchedulingRole } | null> }`
  - `resolvePrincipal(key: ApiKeyRow, deps: PrincipalDeps): Promise<Principal | null>` — client: null if client missing or `status` is `inactive`/`churned`/`suspended`; admin: null if admin missing; admin scopes = `key.scopes ∩ scopesAllowedFor(admin.role)`. Client `portal.user` = `{ id: key.id, name: key.name, email: client.email, role: "owner", isLegacyOwner: false }` — `role: "owner"` so existing `canApproveDeliverables`-style checks pass; write rights are still gated by scopes in the pipeline.

- [ ] **Step 1: Write the failing test**

```ts
// tests/apiv1-principal.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolvePrincipal } from "../lib/apiv1/principal.ts";
import type { ApiKeyRow } from "../lib/apiv1/keys.ts";

const key = (over: Partial<ApiKeyRow>): ApiKeyRow => ({
  id: "k1", principal_type: "client", principal_id: "c1", name: "CI bot", key_prefix: "x", scopes: ["projects:read"],
  created_by: "a@b.c", last_used_at: null, expires_at: null, revoked_at: null, created_at: "t", ...over,
});
const deps = (client: any, admin: any) => ({ getClient: async () => client, getAdmin: async () => admin });

describe("resolvePrincipal", () => {
  it("builds a client principal with a synthetic portal context", async () => {
    const p = await resolvePrincipal(key({}), deps({ id: "c1", name: "Ann", company: "Acme", email: "ann@acme.com", status: "active" }, null));
    assert.equal(p?.type, "client");
    if (p?.type !== "client") return;
    assert.equal(p.portal.client.id, "c1");
    assert.equal(p.portal.user.name, "CI bot");
    assert.equal(p.portal.user.role, "owner");
    assert.deepEqual(p.scopes, ["projects:read"]);
  });
  it("rejects a missing or inactive client", async () => {
    assert.equal(await resolvePrincipal(key({}), deps(null, null)), null);
    assert.equal(await resolvePrincipal(key({}), deps({ id: "c1", name: "", company: "", email: "", status: "inactive" }, null)), null);
  });
  it("caps admin scopes by the admin's current role", async () => {
    const p = await resolvePrincipal(
      key({ principal_type: "admin", principal_id: "a1", scopes: ["leads:read", "audit:read", "webhooks:manage"] }),
      deps(null, { id: "a1", email: "ops@rsg.com", role: "scheduler" }),
    );
    assert.equal(p?.type, "admin");
    assert.deepEqual(p?.scopes, ["webhooks:manage"]);
    assert.equal(await resolvePrincipal(key({ principal_type: "admin", principal_id: "a1" }), deps(null, null)), null);
  });
});
```

(If Task 4 changed the "role without manage_leads" choice, use the same role here.)

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement**

```ts
// lib/apiv1/principal.ts
import type { PortalContext } from "../lifecycle/access";
import type { SchedulingRole } from "../scheduling/permissions";
import type { ApiKeyRow } from "./keys";
import { scopesAllowedFor } from "./scopes";

export type ClientPrincipal = { type: "client"; keyId: string; keyName: string; scopes: string[]; portal: PortalContext };
export type AdminPrincipal = { type: "admin"; keyId: string; keyName: string; scopes: string[]; adminId: string; email: string; role: SchedulingRole };
export type Principal = ClientPrincipal | AdminPrincipal;

export type PrincipalDeps = {
  getClient(id: string): Promise<{ id: string; name: string; company: string; email: string; status: string } | null>;
  getAdmin(id: string): Promise<{ id: string; email: string; role: SchedulingRole } | null>;
};

const BLOCKED_CLIENT_STATUSES = new Set(["inactive", "churned", "suspended"]);

export async function resolvePrincipal(key: ApiKeyRow, deps: PrincipalDeps): Promise<Principal | null> {
  if (key.principal_type === "client") {
    const client = await deps.getClient(key.principal_id);
    if (!client || BLOCKED_CLIENT_STATUSES.has(client.status)) return null;
    return {
      type: "client",
      keyId: key.id,
      keyName: key.name,
      scopes: [...key.scopes],
      portal: {
        client: { id: client.id, name: client.name, company: client.company, email: client.email, status: client.status },
        user: { id: key.id, name: key.name, email: client.email, role: "owner", isLegacyOwner: false },
      },
    };
  }
  const admin = await deps.getAdmin(key.principal_id);
  if (!admin) return null;
  const allowed = new Set<string>(scopesAllowedFor(admin.role));
  return {
    type: "admin",
    keyId: key.id,
    keyName: key.name,
    scopes: key.scopes.filter((s) => allowed.has(s)),
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
  };
}
```

- [ ] **Step 4: Run — expect PASS. Also `npm run typecheck`** (the `PortalContext` shape must match `lib/lifecycle/access.ts`; if `user.role` type is `ClientUserRole = "owner"|"admin"|"member"`, `"owner"` is valid).

- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/principal.ts tests/apiv1-principal.test.ts
git commit -m "API platform: principal resolution for client and admin keys"
```

---

### Task 7: Idempotency store

**Files:**
- Create: `lib/apiv1/idempotency.ts`
- Test: `tests/apiv1-idempotency.test.ts`

**Interfaces:**
- Produces:
  - `requestHash(method: string, path: string, rawBody: string): string` (hex sha256 of `${method.toUpperCase()} ${path}\n${rawBody}`)
  - `type IdemDb = { from(table: "api_idempotency"): any }` (a Supabase client narrowed to what we use)
  - `beginIdempotent(db: IdemDb, input: { principalId: string; key: string; requestHash: string }): Promise<{ kind: "new" } | { kind: "replay"; status: number; body: unknown } | { kind: "mismatch" } | { kind: "in_flight" }>`
  - `completeIdempotent(db: IdemDb, input: { principalId: string; key: string; status: number; body: unknown }): Promise<void>`
  - `abandonIdempotent(db, { principalId, key })` — deletes the in-flight row when the handler throws, so the client can retry.
  - `keylessPrincipalId(ip: string): string` — deterministic uuid-shaped id (`00000000-0000-4000-8000-` + first 12 hex of sha256(ip)) for public routes.

Supabase calls used (so the fake can match): `insert({...})` returning `{ error: { code: "23505" } }` on conflict; `select("request_hash,status,response_status,response_body").eq("principal_id", …).eq("key", …).maybeSingle()`; `update({...}).eq(…).eq(…)`; `delete().eq(…).eq(…)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/apiv1-idempotency.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { abandonIdempotent, beginIdempotent, completeIdempotent, keylessPrincipalId, requestHash } from "../lib/apiv1/idempotency.ts";

type Row = { request_hash: string; status: "in_flight" | "done"; response_status: number | null; response_body: unknown };

/** Minimal fake of the four builder shapes idempotency.ts uses. */
function fakeDb(existing: Row | null) {
  const log: string[] = [];
  let row = existing;
  const chain = (kind: string) => {
    const self: any = {};
    self.eq = () => self;
    self.maybeSingle = async () => ({ data: row, error: null });
    self.then = (res: (v: any) => void) => {
      log.push(kind);
      if (kind === "delete") row = null;
      res({ data: null, error: null });
    };
    return self;
  };
  const db = {
    from: () => ({
      insert: async (v: any) => {
        log.push("insert");
        if (row) return { error: { code: "23505", message: "dup" } };
        row = { request_hash: v.request_hash, status: v.status, response_status: null, response_body: null };
        return { error: null };
      },
      select: () => chain("select"),
      update: (v: any) => { row = row ? { ...row, ...v } : row; return chain("update"); },
      delete: () => chain("delete"),
    }),
  };
  return { db, log, get row() { return row; } };
}

describe("idempotency", () => {
  const base = { principalId: "p", key: "k-12345678", requestHash: requestHash("POST", "/v1/tickets", '{"a":1}') };

  it("hashes method+path+body", () => {
    assert.notEqual(requestHash("POST", "/x", "a"), requestHash("POST", "/x", "b"));
    assert.equal(requestHash("post", "/x", "a"), requestHash("POST", "/x", "a"));
  });
  it("new → in_flight row; complete → done", async () => {
    const f = fakeDb(null);
    assert.deepEqual(await beginIdempotent(f.db, base), { kind: "new" });
    assert.equal(f.row?.status, "in_flight");
    await completeIdempotent(f.db, { principalId: "p", key: base.key, status: 201, body: { id: 1 } });
    assert.equal(f.row?.status, "done");
    assert.equal(f.row?.response_status, 201);
  });
  it("replays a done row with the same hash", async () => {
    const f = fakeDb({ request_hash: base.requestHash, status: "done", response_status: 201, response_body: { id: 1 } });
    assert.deepEqual(await beginIdempotent(f.db, base), { kind: "replay", status: 201, body: { id: 1 } });
  });
  it("mismatch and in_flight", async () => {
    assert.deepEqual(await beginIdempotent(fakeDb({ request_hash: "other", status: "done", response_status: 200, response_body: {} }).db, base), { kind: "mismatch" });
    assert.deepEqual(await beginIdempotent(fakeDb({ request_hash: base.requestHash, status: "in_flight", response_status: null, response_body: null }).db, base), { kind: "in_flight" });
  });
  it("abandon deletes the row", async () => {
    const f = fakeDb({ request_hash: base.requestHash, status: "in_flight", response_status: null, response_body: null });
    await abandonIdempotent(f.db, { principalId: "p", key: base.key });
    assert.equal(f.row, null);
  });
  it("keyless principal ids are stable uuids", () => {
    assert.equal(keylessPrincipalId("1.2.3.4"), keylessPrincipalId("1.2.3.4"));
    assert.match(keylessPrincipalId("1.2.3.4"), /^00000000-0000-4000-8000-[0-9a-f]{12}$/);
  });
});
```

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement**

```ts
// lib/apiv1/idempotency.ts
import { createHash } from "node:crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IdemDb = { from(table: "api_idempotency"): any };

export function requestHash(method: string, path: string, rawBody: string): string {
  return createHash("sha256").update(`${method.toUpperCase()} ${path}\n${rawBody}`).digest("hex");
}

export function keylessPrincipalId(ip: string): string {
  const h = createHash("sha256").update(ip).digest("hex").slice(0, 12);
  return `00000000-0000-4000-8000-${h}`;
}

export type BeginResult =
  | { kind: "new" }
  | { kind: "replay"; status: number; body: unknown }
  | { kind: "mismatch" }
  | { kind: "in_flight" };

export async function beginIdempotent(
  db: IdemDb,
  input: { principalId: string; key: string; requestHash: string },
): Promise<BeginResult> {
  const { error } = await db.from("api_idempotency").insert({
    principal_id: input.principalId,
    key: input.key,
    request_hash: input.requestHash,
    status: "in_flight",
  });
  if (!error) return { kind: "new" };
  if (error.code !== "23505") throw new Error(`idempotency insert: ${error.message}`);
  const { data } = await db
    .from("api_idempotency")
    .select("request_hash,status,response_status,response_body")
    .eq("principal_id", input.principalId)
    .eq("key", input.key)
    .maybeSingle();
  if (!data) return { kind: "new" }; // row vanished between insert and select: treat as fresh
  if (data.request_hash !== input.requestHash) return { kind: "mismatch" };
  if (data.status === "in_flight") return { kind: "in_flight" };
  return { kind: "replay", status: data.response_status ?? 200, body: data.response_body };
}

export async function completeIdempotent(
  db: IdemDb,
  input: { principalId: string; key: string; status: number; body: unknown },
): Promise<void> {
  await db
    .from("api_idempotency")
    .update({ status: "done", response_status: input.status, response_body: input.body })
    .eq("principal_id", input.principalId)
    .eq("key", input.key);
}

export async function abandonIdempotent(db: IdemDb, input: { principalId: string; key: string }): Promise<void> {
  await db.from("api_idempotency").delete().eq("principal_id", input.principalId).eq("key", input.key);
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/idempotency.ts tests/apiv1-idempotency.test.ts
git commit -m "API platform: idempotency store"
```

---

### Task 8: Usage log and path templating

**Files:**
- Create: `lib/apiv1/usage.ts`
- Test: `tests/apiv1-usage.test.ts`

**Interfaces:**
- Produces:
  - `templatePath(pathname: string, params: Record<string, string>): string` — replaces each param value segment with `{name}`; strips the `/api` prefix so `/api/v1/tickets/abc` with `{id:"abc"}` → `/v1/tickets/{id}`.
  - `type UsageRow = { key_id: string | null; principal_type: "client" | "admin" | null; principal_id: string | null; method: string; path: string; status: number; duration_ms: number; ip: string | null; correlation_id: string | null }`
  - `recordUsage(db: { from(t: "api_requests"): any }, row: UsageRow): void` — fire-and-forget, swallows and `console.warn`s errors.

- [ ] **Step 1: Write the failing test**

```ts
// tests/apiv1-usage.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recordUsage, templatePath } from "../lib/apiv1/usage.ts";

describe("templatePath", () => {
  it("replaces param segments and drops /api", () => {
    assert.equal(templatePath("/api/v1/tickets/abc/messages", { id: "abc" }), "/v1/tickets/{id}/messages");
    assert.equal(templatePath("/api/v1/projects/p1/tasks/t1/complete", { id: "p1", tid: "t1" }), "/v1/projects/{id}/tasks/{tid}/complete");
    assert.equal(templatePath("/api/v1/me", {}), "/v1/me");
  });
});

describe("recordUsage", () => {
  it("inserts without awaiting and never throws", async () => {
    const inserted: unknown[] = [];
    const db = { from: () => ({ insert: async (r: unknown) => { inserted.push(r); return { error: null }; } }) };
    recordUsage(db, { key_id: "k", principal_type: "client", principal_id: "c", method: "GET", path: "/v1/me", status: 200, duration_ms: 3, ip: "1.1.1.1", correlation_id: "x" });
    await new Promise((r) => setImmediate(r));
    assert.equal(inserted.length, 1);
    const bad = { from: () => ({ insert: async () => { throw new Error("down"); } }) };
    assert.doesNotThrow(() => recordUsage(bad, { key_id: null, principal_type: null, principal_id: null, method: "GET", path: "/v1/x", status: 500, duration_ms: 1, ip: null, correlation_id: null }));
    await new Promise((r) => setImmediate(r));
  });
});
```

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement**

```ts
// lib/apiv1/usage.ts
export type UsageRow = {
  key_id: string | null;
  principal_type: "client" | "admin" | null;
  principal_id: string | null;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  ip: string | null;
  correlation_id: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UsageDb = { from(table: "api_requests"): any };

/** `/api/v1/tickets/abc` + { id: "abc" } → `/v1/tickets/{id}` (no ids in the log). */
export function templatePath(pathname: string, params: Record<string, string>): string {
  const byValue = new Map(Object.entries(params).map(([k, v]) => [v, k]));
  const segs = pathname.split("/").map((s) => (byValue.has(s) ? `{${byValue.get(s)}}` : s));
  const joined = segs.join("/");
  return joined.startsWith("/api/") ? joined.slice(4) : joined;
}

export function recordUsage(db: UsageDb, row: UsageRow): void {
  Promise.resolve()
    .then(() => db.from("api_requests").insert(row))
    .then((r: { error?: { message: string } | null } | void) => {
      if (r && r.error) console.warn("[apiv1] usage insert failed:", r.error.message);
    })
    .catch((err: unknown) => console.warn("[apiv1] usage insert failed:", err));
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/usage.ts tests/apiv1-usage.test.ts
git commit -m "API platform: usage log"
```

---

### Task 9: Pipeline — `withApi`

**Files:**
- Create: `lib/apiv1/types.ts`, `lib/apiv1/registry.ts`, `lib/apiv1/pipeline.ts`
- Test: `tests/apiv1-pipeline.test.ts`

**Interfaces:**
- Consumes: Tasks 2–8.
- Produces (`lib/apiv1/types.ts`):

```ts
import type { ZodType } from "zod";
import type { Principal } from "./principal";

export type AuthMode = "client" | "admin" | "none";

export type OperationMeta = {
  operationId: string;
  summary: string;
  tag: string;
  response: ZodType;
};

export type ApiConfig<B = unknown, Q = unknown> = {
  auth: AuthMode;
  scopes?: string[];
  idempotent?: boolean;
  rateLimit?: { limit: number; windowMs: number };
  body?: ZodType<B>;
  query?: ZodType<Q>;
  meta: OperationMeta;
};

export type HandlerArgs<B, Q> = {
  principal: Principal | null;
  body: B;
  query: Q;
  params: Record<string, string>;
  request: Request;
  correlationId: string;
};

export type HandlerResult = { data: unknown; meta?: Record<string, unknown>; status?: number; headers?: Record<string, string> };

export type ApiHandler<B, Q> = (args: HandlerArgs<B, Q>) => Promise<HandlerResult>;

export type RouteContext = { params: Promise<Record<string, string>> };
export type RouteHandler = (request: Request, ctx: RouteContext) => Promise<Response>;
```

  - `lib/apiv1/registry.ts`: `registerOperation(method: string, meta: OperationMeta & { auth: AuthMode; scopes: string[]; idempotent: boolean })`, `listOperations()` (returns a copy), `resetOperations()` (tests).
  - `lib/apiv1/pipeline.ts`:

```ts
export type PipelineDeps = {
  enabled(): boolean;
  resolveKey(bearer: string | null): Promise<ApiKeyRow | null>;
  resolvePrincipal(key: ApiKeyRow): Promise<Principal | null>;
  rateLimit(key: string, limit: number, windowMs: number): Promise<boolean>;
  clientIp(request: Request): string;
  idempotency: IdemDb | null;      // null → idempotent routes fail with 503 unavailable
  usage: UsageDb | null;           // null → skip logging
  now?: () => number;
};
export function withApi<B = undefined, Q = undefined>(method: string, config: ApiConfig<B, Q>, handler: ApiHandler<B, Q>, deps: PipelineDeps): RouteHandler;
export function corsHeaders(): Record<string, string>;
export function optionsHandler(): RouteHandler;
```

Pipeline behaviour (exact):
1. `correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID()`; `start = now()`.
2. `!deps.enabled()` → 503 `unavailable` "The API is not enabled."
3. Auth: `bearer = parseBearer(authorization)`. If `bearer` → `key = resolveKey(bearer)`; if null → 401 `unauthenticated` "Invalid API key." Else `principal = resolvePrincipal(key)`; null → 401 "Invalid API key." If `config.auth !== "none"` and no bearer → 401 "Missing API key." If `config.auth === "client"|"admin"` and `principal.type !== config.auth` → 403 `insufficient_scope` "This key cannot access this resource."
4. Scopes: every `config.scopes` must be in `principal.scopes` else 403 `insufficient_scope` with `details: { required: config.scopes }`. (`auth:"none"` routes with scopes are a config error → throw at registration.)
5. Rate limit: `key = principal ? \`api:key:${principal.keyId}\` : \`api:ip:${clientIp}\``; limits from `config.rateLimit` or defaults (600/600 000 keyed, 60/600 000 keyless). Denied → 429 `rate_limited` with header `Retry-After: 60`.
6. Query: parse `new URL(request.url).searchParams` into a plain object (first value per key); validate with `config.query` if present (422 `validation_failed`, `details = flatten()`), else `{}`.
7. Body: for POST/PATCH/PUT/DELETE read `rawBody = await request.text()`; if `config.body`: parse JSON (invalid → 422 `validation_failed` `{ body: ["invalid JSON"] }`) then schema (422 with `flatten()`); if no `config.body`, body = `undefined`.
8. Idempotency (if `config.idempotent`): header `idempotency-key` trimmed, length 8–200 else 400 `idempotency_required`. `principalId = principal?.type ? principalIdOf(principal) : keylessPrincipalId(ip)` where `principalIdOf` = `portal.client.id` for client, `adminId` for admin. If `deps.idempotency` null → 503. `beginIdempotent` → `replay` → respond stored status/body + header `Idempotent-Replayed: true`; `mismatch` → 422 `idempotency_mismatch`; `in_flight` → 409 `conflict`.
9. `params = await ctx.params`. Run handler. On throw: if idempotent and began `new`, `abandonIdempotent`; map via `toApiError`; log non-ApiError with `console.error("[apiv1]", correlationId, err)`.
10. Success response: `status = result.status ?? 200`, body `{ data, ...(meta ? { meta } : {}) }`. If idempotent, `completeIdempotent` with status+body.
11. Every response gets `x-correlation-id`, CORS headers, and `Content-Type: application/json` (unless `result.headers` sets a `Location` — then status is used as-is, e.g. 302 for downloads, and body is still the JSON envelope).
12. `recordUsage` with `templatePath(pathname, params)`, `duration_ms = now() - start`.

Deviation from spec §2.4, recorded here on purpose: `X-RateLimit-Limit/Remaining` are **not** emitted in Phase 1 because `lib/security.rateLimit()` returns only a boolean. Document this in `docs/api-platform.md` (Task 20); Phase 2 may extend `rateLimit()` to return remaining counts.

CORS headers: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS`, `Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key`, `Access-Control-Expose-Headers: x-correlation-id, X-RateLimit-Limit, X-RateLimit-Remaining, Idempotent-Replayed`, `Access-Control-Max-Age: 86400`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/apiv1-pipeline.test.ts
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { withApi, optionsHandler, type PipelineDeps } from "../lib/apiv1/pipeline.ts";
import { generateApiKey, type ApiKeyRow } from "../lib/apiv1/keys.ts";
import type { Principal } from "../lib/apiv1/principal.ts";
import { ApiError } from "../lib/apiv1/errors.ts";
import { resetOperations, listOperations } from "../lib/apiv1/registry.ts";

const key = generateApiKey();
const keyRow: ApiKeyRow = { id: "k1", principal_type: "client", principal_id: "c1", name: "n", key_prefix: key.prefix, scopes: ["tickets:read", "tickets:write"], created_by: "x", last_used_at: null, expires_at: null, revoked_at: null, created_at: "t" };
const clientPrincipal: Principal = { type: "client", keyId: "k1", keyName: "n", scopes: keyRow.scopes, portal: { client: { id: "c1", name: "A", company: "Acme", email: "a@acme.com", status: "active" }, user: { id: "k1", name: "n", email: "a@acme.com", role: "owner", isLegacyOwner: false } } };

function idemDb() {
  const rows = new Map<string, any>();
  return {
    rows,
    from: () => ({
      insert: async (v: any) => { const id = `${v.principal_id}:${v.key}`; if (rows.has(id)) return { error: { code: "23505", message: "dup" } }; rows.set(id, { ...v, response_status: null, response_body: null }); return { error: null }; },
      select: () => { const s: any = { _f: [] as string[] }; s.eq = (_c: string, v: string) => { s._f.push(v); return s; }; s.maybeSingle = async () => ({ data: rows.get(s._f.join(":")) ?? null, error: null }); return s; },
      update: (v: any) => { const s: any = { _f: [] as string[] }; s.eq = (_c: string, val: string) => { s._f.push(val); return s; }; s.then = (r: any) => { const id = s._f.join(":"); rows.set(id, { ...rows.get(id), ...v }); r({ error: null }); }; return s; },
      delete: () => { const s: any = { _f: [] as string[] }; s.eq = (_c: string, val: string) => { s._f.push(val); return s; }; s.then = (r: any) => { rows.delete(s._f.join(":")); r({ error: null }); }; return s; },
    }),
  };
}

function mkDeps(over: Partial<PipelineDeps> = {}) {
  const usage: unknown[] = [];
  const limited = { allow: true };
  const deps: PipelineDeps = {
    enabled: () => true,
    resolveKey: async (b) => (b === key.plaintext ? keyRow : null),
    resolvePrincipal: async () => clientPrincipal,
    rateLimit: async () => limited.allow,
    clientIp: () => "9.9.9.9",
    idempotency: idemDb(),
    usage: { from: () => ({ insert: async (r: unknown) => { usage.push(r); return { error: null }; } }) },
    ...over,
  };
  return { deps, usage, limited };
}

const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });
const req = (method: string, path: string, init: { auth?: string | null; body?: unknown; headers?: Record<string, string> } = {}) =>
  new Request(`http://x${path}`, {
    method,
    headers: { ...(init.auth === null ? {} : { authorization: `Bearer ${init.auth ?? key.plaintext}` }), ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...(init.headers ?? {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
const meta = (id: string) => ({ operationId: id, summary: id, tag: "Test", response: z.any() });

describe("withApi", () => {
  beforeEach(() => resetOperations());

  it("503 when disabled", async () => {
    const { deps } = mkDeps({ enabled: () => false });
    const h = withApi("GET", { auth: "none", meta: meta("a") }, async () => ({ data: 1 }), deps);
    const res = await h(req("GET", "/api/v1/x", { auth: null }), ctx());
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.code, "unavailable");
  });

  it("401 missing / invalid key; 403 wrong principal type; 403 missing scope", async () => {
    const { deps } = mkDeps();
    const h = withApi("GET", { auth: "client", scopes: ["tickets:read"], meta: meta("b") }, async () => ({ data: 1 }), deps);
    assert.equal((await h(req("GET", "/api/v1/x", { auth: null }), ctx())).status, 401);
    assert.equal((await h(req("GET", "/api/v1/x", { auth: "rsg_live_bad" }), ctx())).status, 401);
    const admin = withApi("GET", { auth: "admin", meta: meta("c") }, async () => ({ data: 1 }), deps);
    assert.equal((await admin(req("GET", "/api/v1/x"), ctx())).status, 403);
    const scoped = withApi("GET", { auth: "client", scopes: ["billing:read"], meta: meta("d") }, async () => ({ data: 1 }), deps);
    const res = await scoped(req("GET", "/api/v1/x"), ctx());
    assert.equal(res.status, 403);
    assert.deepEqual((await res.json()).error.details, { required: ["billing:read"] });
  });

  it("happy path: envelope, headers, params, usage row", async () => {
    const { deps, usage } = mkDeps();
    const h = withApi("GET", { auth: "client", scopes: ["tickets:read"], meta: meta("e") }, async ({ params, principal }) => ({ data: { id: params.id, who: principal?.type } }), deps);
    const res = await h(req("GET", "/api/v1/tickets/t1"), ctx({ id: "t1" }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { data: { id: "t1", who: "client" } });
    assert.ok(res.headers.get("x-correlation-id"));
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    await new Promise((r) => setImmediate(r));
    assert.equal(usage.length, 1);
    assert.equal((usage[0] as any).path, "/v1/tickets/{id}");
    assert.equal((usage[0] as any).key_id, "k1");
  });

  it("429 with Retry-After", async () => {
    const { deps, limited } = mkDeps();
    limited.allow = false;
    const h = withApi("GET", { auth: "none", meta: meta("f") }, async () => ({ data: 1 }), deps);
    const res = await h(req("GET", "/api/v1/x", { auth: null }), ctx());
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("retry-after"), "60");
  });

  it("422 on invalid JSON and on schema failure; query validated", async () => {
    const { deps } = mkDeps();
    const h = withApi("POST", { auth: "client", body: z.object({ subject: z.string().min(1) }), query: z.object({ status: z.enum(["open"]).optional() }), meta: meta("g") }, async ({ body }) => ({ data: body }), deps);
    const bad = new Request("http://x/api/v1/t", { method: "POST", headers: { authorization: `Bearer ${key.plaintext}` }, body: "{nope" });
    assert.equal((await h(bad, ctx())).status, 422);
    const res = await h(req("POST", "/api/v1/t", { body: { subject: "" } }), ctx());
    assert.equal(res.status, 422);
    assert.equal((await res.json()).error.code, "validation_failed");
    assert.equal((await h(req("POST", "/api/v1/t?status=closed", { body: { subject: "x" } }), ctx())).status, 422);
    assert.equal((await h(req("POST", "/api/v1/t?status=open", { body: { subject: "x" } }), ctx())).status, 200);
  });

  it("idempotency: required, replay, mismatch, in-flight, abandon on error", async () => {
    const { deps } = mkDeps();
    let calls = 0;
    const h = withApi("POST", { auth: "client", idempotent: true, body: z.object({ n: z.number() }), meta: meta("h") }, async ({ body }) => { calls++; if (body.n < 0) throw new ApiError(409, "conflict", "neg"); return { data: { n: body.n, calls }, status: 201 }; }, deps);
    assert.equal((await h(req("POST", "/api/v1/t", { body: { n: 1 } }), ctx())).status, 400);
    const hdr = { "idempotency-key": "abc-12345" };
    const r1 = await h(req("POST", "/api/v1/t", { body: { n: 1 }, headers: hdr }), ctx());
    assert.equal(r1.status, 201);
    const r2 = await h(req("POST", "/api/v1/t", { body: { n: 1 }, headers: hdr }), ctx());
    assert.equal(r2.status, 201);
    assert.equal(r2.headers.get("idempotent-replayed"), "true");
    assert.deepEqual(await r2.json(), { data: { n: 1, calls: 1 } });
    assert.equal(calls, 1);
    const r3 = await h(req("POST", "/api/v1/t", { body: { n: 2 }, headers: hdr }), ctx());
    assert.equal(r3.status, 422);
    assert.equal((await r3.json()).error.code, "idempotency_mismatch");
    // error path abandons the row so a retry re-executes
    const hdr2 = { "idempotency-key": "err-12345" };
    assert.equal((await h(req("POST", "/api/v1/t", { body: { n: -1 }, headers: hdr2 }), ctx())).status, 409);
    assert.equal((await h(req("POST", "/api/v1/t", { body: { n: -1 }, headers: hdr2 }), ctx())).status, 409);
    assert.equal(calls, 3);
  });

  it("maps unknown errors to opaque 500 and still logs usage", async () => {
    const { deps, usage } = mkDeps();
    const h = withApi("GET", { auth: "none", meta: meta("i") }, async () => { throw new Error("pg down"); }, deps);
    const res = await h(req("GET", "/api/v1/x", { auth: null }), ctx());
    assert.equal(res.status, 500);
    assert.equal((await res.json()).error.message, "Something went wrong.");
    await new Promise((r) => setImmediate(r));
    assert.equal((usage[0] as any).status, 500);
  });

  it("registers operations and answers OPTIONS", async () => {
    const { deps } = mkDeps();
    withApi("GET", { auth: "none", meta: meta("j") }, async () => ({ data: 1 }), deps);
    assert.equal(listOperations().length, 1);
    assert.equal(listOperations()[0]!.operationId, "j");
    const res = await optionsHandler()(new Request("http://x/api/v1/x", { method: "OPTIONS" }), ctx());
    assert.equal(res.status, 204);
    assert.ok(res.headers.get("access-control-allow-headers")?.includes("Idempotency-Key"));
  });
});
```

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement** `lib/apiv1/types.ts` (as in Interfaces), then:

```ts
// lib/apiv1/registry.ts
import type { AuthMode, OperationMeta } from "./types";

export type RegisteredOperation = OperationMeta & { method: string; auth: AuthMode; scopes: string[]; idempotent: boolean };

const operations: RegisteredOperation[] = [];

export function registerOperation(op: RegisteredOperation): void {
  const i = operations.findIndex((o) => o.operationId === op.operationId);
  if (i >= 0) operations[i] = op; // hot reload re-registers
  else operations.push(op);
}
export function listOperations(): RegisteredOperation[] {
  return [...operations];
}
export function resetOperations(): void {
  operations.length = 0;
}
```

```ts
// lib/apiv1/pipeline.ts
import type { ZodError } from "zod";
import { ApiError, errorBody, toApiError } from "./errors";
import { abandonIdempotent, beginIdempotent, completeIdempotent, keylessPrincipalId, requestHash, type IdemDb } from "./idempotency";
import { parseBearer, type ApiKeyRow } from "./keys";
import type { Principal } from "./principal";
import { registerOperation } from "./registry";
import type { ApiConfig, ApiHandler, HandlerResult, RouteHandler } from "./types";
import { recordUsage, templatePath, type UsageDb } from "./usage";

export type PipelineDeps = {
  enabled(): boolean;
  resolveKey(bearer: string | null): Promise<ApiKeyRow | null>;
  resolvePrincipal(key: ApiKeyRow): Promise<Principal | null>;
  rateLimit(key: string, limit: number, windowMs: number): Promise<boolean>;
  clientIp(request: Request): string;
  idempotency: IdemDb | null;
  usage: UsageDb | null;
  now?: () => number;
};

const KEYED_LIMIT = { limit: 600, windowMs: 10 * 60_000 };
const KEYLESS_LIMIT = { limit: 60, windowMs: 10 * 60_000 };
const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
    "Access-Control-Expose-Headers": "x-correlation-id, X-RateLimit-Limit, X-RateLimit-Remaining, Idempotent-Replayed",
    "Access-Control-Max-Age": "86400",
  };
}

export function optionsHandler(): RouteHandler {
  return async () => new Response(null, { status: 204, headers: corsHeaders() });
}

function json(status: number, body: unknown, correlationId: string, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "x-correlation-id": correlationId, ...corsHeaders(), ...extra },
  });
}

function principalIdOf(p: Principal): string {
  return p.type === "client" ? p.portal.client.id : p.adminId;
}

function zodDetails(err: unknown): unknown {
  const z = err as ZodError;
  return typeof (z as { flatten?: unknown }).flatten === "function" ? z.flatten() : undefined;
}

export function withApi<B = undefined, Q = undefined>(
  method: string,
  config: ApiConfig<B, Q>,
  handler: ApiHandler<B, Q>,
  deps: PipelineDeps,
): RouteHandler {
  if (config.auth === "none" && config.scopes?.length) {
    throw new Error(`withApi(${config.meta.operationId}): scopes on an unauthenticated route`);
  }
  registerOperation({ ...config.meta, method, auth: config.auth, scopes: config.scopes ?? [], idempotent: Boolean(config.idempotent) });

  return async (request, ctx) => {
    const now = deps.now ?? Date.now;
    const start = now();
    const correlationId = request.headers.get("x-correlation-id")?.slice(0, 64) || crypto.randomUUID();
    const url = new URL(request.url);
    let principal: Principal | null = null;
    let params: Record<string, string> = {};
    let idem: { principalId: string; key: string } | null = null;

    const finish = (res: Response) => {
      if (deps.usage) {
        recordUsage(deps.usage, {
          key_id: principal?.keyId ?? null,
          principal_type: principal?.type ?? null,
          principal_id: principal ? principalIdOf(principal) : null,
          method: request.method,
          path: templatePath(url.pathname, params),
          status: res.status,
          duration_ms: Math.max(0, now() - start),
          ip: deps.clientIp(request),
          correlation_id: correlationId,
        });
      }
      return res;
    };
    const fail = (err: ApiError, extra?: Record<string, string>) => finish(json(err.status, errorBody(err, correlationId), correlationId, extra));

    try {
      if (!deps.enabled()) throw new ApiError(503, "unavailable", "The API is not enabled.");

      // Auth
      const bearer = parseBearer(request.headers.get("authorization"));
      if (bearer) {
        const key = await deps.resolveKey(bearer);
        principal = key ? await deps.resolvePrincipal(key) : null;
        if (!principal) throw new ApiError(401, "unauthenticated", "Invalid API key.");
      } else if (config.auth !== "none") {
        throw new ApiError(401, "unauthenticated", "Missing API key.");
      }
      if (config.auth !== "none" && principal!.type !== config.auth) {
        throw new ApiError(403, "insufficient_scope", "This key cannot access this resource.");
      }
      const required = config.scopes ?? [];
      if (required.length && !required.every((s) => principal!.scopes.includes(s))) {
        throw new ApiError(403, "insufficient_scope", "This key lacks a required scope.", { required });
      }

      // Rate limit
      const ip = deps.clientIp(request);
      const rl = config.rateLimit ?? (principal ? KEYED_LIMIT : KEYLESS_LIMIT);
      const rlKey = principal ? `api:key:${principal.keyId}` : `api:ip:${ip}`;
      if (!(await deps.rateLimit(rlKey, rl.limit, rl.windowMs))) {
        return fail(new ApiError(429, "rated_limited" as never, "Rate limit exceeded."), { "Retry-After": "60" });
      }

      // Query
      const rawQuery: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { if (!(k in rawQuery)) rawQuery[k] = v; });
      let query: Q = {} as Q;
      if (config.query) {
        const r = config.query.safeParse(rawQuery);
        if (!r.success) throw new ApiError(422, "validation_failed", "Invalid query.", zodDetails(r.error));
        query = r.data;
      }

      // Body
      let rawBody = "";
      let body: B = undefined as B;
      if (MUTATING.has(request.method)) {
        rawBody = await request.text();
        if (config.body) {
          let parsed: unknown;
          try { parsed = rawBody ? JSON.parse(rawBody) : {}; } catch { throw new ApiError(422, "validation_failed", "Invalid JSON.", { body: ["invalid JSON"] }); }
          const r = config.body.safeParse(parsed);
          if (!r.success) throw new ApiError(422, "validation_failed", "Invalid request.", zodDetails(r.error));
          body = r.data;
        }
      }

      // Idempotency
      if (config.idempotent) {
        const k = request.headers.get("idempotency-key")?.trim() ?? "";
        if (k.length < 8 || k.length > 200) throw new ApiError(400, "idempotency_required", "A valid Idempotency-Key header (8–200 chars) is required.");
        if (!deps.idempotency) throw new ApiError(503, "unavailable", "Idempotency storage is not configured.");
        const principalId = principal ? principalIdOf(principal) : keylessPrincipalId(ip);
        const begun = await beginIdempotent(deps.idempotency, { principalId, key: k, requestHash: requestHash(request.method, url.pathname, rawBody) });
        if (begun.kind === "replay") return finish(json(begun.status, begun.body, correlationId, { "Idempotent-Replayed": "true" }));
        if (begun.kind === "mismatch") throw new ApiError(422, "idempotency_mismatch", "Idempotency-Key was already used with a different request.");
        if (begun.kind === "in_flight") throw new ApiError(409, "conflict", "A request with this Idempotency-Key is still in progress.");
        idem = { principalId, key: k };
      }

      params = await ctx.params;
      let result: HandlerResult;
      try {
        result = await handler({ principal, body, query, params, request, correlationId });
      } catch (err) {
        if (idem && deps.idempotency) await abandonIdempotent(deps.idempotency, idem).catch(() => {});
        throw err;
      }
      const status = result.status ?? 200;
      const payload = { data: result.data, ...(result.meta ? { meta: result.meta } : {}) };
      if (idem && deps.idempotency) await completeIdempotent(deps.idempotency, { ...idem, status, body: payload });
      return finish(json(status, payload, correlationId, result.headers));
    } catch (err) {
      const apiErr = toApiError(err);
      if (apiErr.code === "internal") console.error("[apiv1]", correlationId, err);
      return fail(apiErr);
    }
  };
}
```

Fix the deliberate typo before running: the 429 line must use `"rate_limited"` (not `"rated_limited" as never`). The test asserts the code string via `errorBody`.

- [ ] **Step 4: Run — expect PASS**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/types.ts lib/apiv1/registry.ts lib/apiv1/pipeline.ts tests/apiv1-pipeline.test.ts
git commit -m "API platform: withApi request pipeline"
```

---

### Task 10: Runtime wiring + `/api/v1/me`

**Files:**
- Create: `lib/apiv1/runtime.ts`, `app/api/v1/me/route.ts`
- Modify: `.env.example` (add `API_PLATFORM_ENABLED=`)

**Interfaces:**
- Produces: `api<B, Q>(method, config, handler): RouteHandler` (= `withApi` with real deps), `OPTIONS` re-export helper `options = optionsHandler()`, `realDeps: PipelineDeps`.

- [ ] **Step 1: Implement runtime**

```ts
// lib/apiv1/runtime.ts
import { getSupabase } from "@/lib/supabase";
import { apiPlatformEnabled } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/security";
import { getAdminById, getClientById } from "@/lib/store";
import { resolveApiKey, type ApiKeyRow } from "./keys";
import { resolvePrincipal } from "./principal";
import { optionsHandler, withApi, type PipelineDeps } from "./pipeline";
import type { ApiConfig, ApiHandler, RouteHandler } from "./types";

async function findByHash(hash: string): Promise<ApiKeyRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from("api_keys").select("*").eq("key_hash", hash).maybeSingle();
  return (data as ApiKeyRow | null) ?? null;
}

async function touch(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", id);
}

export const realDeps: PipelineDeps = {
  enabled: apiPlatformEnabled,
  resolveKey: (bearer) => resolveApiKey(bearer, { findByHash, touch }),
  resolvePrincipal: (key) =>
    resolvePrincipal(key, {
      getClient: async (id) => {
        const c = await getClientById(id);
        if (!c) return null;
        const status = typeof (c as { status?: unknown }).status === "string" ? ((c as { status: string }).status) : "active";
        return { id: c.id, name: c.name, company: c.company, email: c.email, status };
      },
      getAdmin: async (id) => {
        const a = await getAdminById(id);
        return a ? { id: a.id, email: a.email, role: a.role } : null;
      },
    }),
  rateLimit,
  clientIp,
  get idempotency() { return getSupabase(); },
  get usage() { return getSupabase(); },
};

export function api<B = undefined, Q = undefined>(method: string, config: ApiConfig<B, Q>, handler: ApiHandler<B, Q>): RouteHandler {
  return withApi(method, config, handler, realDeps);
}

export const options = optionsHandler();
```

Check `getClientById` signature first (`sed -n 175,197p lib/store.ts`); if it takes extra args, adapt.

- [ ] **Step 2: First route**

```ts
// app/api/v1/me/route.ts
import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const response = z.object({
  principal: z.enum(["client", "admin"]),
  key: z.object({ id: z.string(), name: z.string(), scopes: z.array(z.string()) }),
  client: z.object({ id: z.string(), company: z.string(), name: z.string(), email: z.string(), status: z.string() }).optional(),
  admin: z.object({ id: z.string(), email: z.string(), role: z.string() }).optional(),
});

export const GET = api("GET", {
  auth: "none",
  meta: { operationId: "getMe", summary: "Identify the calling key", tag: "Account", response },
}, async ({ principal }) => {
  if (!principal) throw new (await import("@/lib/apiv1/errors")).ApiError(401, "unauthenticated", "Missing API key.");
  const key = { id: principal.keyId, name: principal.keyName, scopes: principal.scopes };
  if (principal.type === "client") {
    const c = principal.portal.client;
    return { data: { principal: "client", key, client: { id: c.id, company: c.company, name: c.name, email: c.email, status: c.status } } };
  }
  return { data: { principal: "admin", key, admin: { id: principal.adminId, email: principal.email, role: principal.role } } };
});

export const OPTIONS = options;
```

Replace the dynamic import with a normal top-level `import { ApiError } from "@/lib/apiv1/errors";` — it is shown inline only to make the dependency explicit. `auth: "none"` here is deliberate: `/me` works for either principal type and rejects keyless callers itself.

- [ ] **Step 3: Add to `.env.example`**

```
# Public API (/api/v1). Leave unset to keep it dark.
API_PLATFORM_ENABLED=
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`. Then smoke: start `npm run dev` with `API_PLATFORM_ENABLED=true` and `curl -i http://localhost:3000/api/v1/me` → 401 JSON envelope with `x-correlation-id`; `curl -i -X OPTIONS http://localhost:3000/api/v1/me` → 204 with CORS headers; `curl -i -X POST http://localhost:3000/api/v1/me -H "user-agent: curl"` → must NOT be the middleware's 403 "Request blocked." (proves the bypass); without the env var → 503.

- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/runtime.ts app/api/v1/me/route.ts .env.example
git commit -m "API platform: runtime wiring and GET /api/v1/me"
```

---

### Task 11: Serializers and ownership guards

**Files:**
- Create: `lib/apiv1/serializers.ts`, `lib/apiv1/ownership.ts`
- Test: `tests/apiv1-serializers.test.ts`

**Interfaces:**
- Consumes: types from `../lifecycle/types` (`Project`, `Milestone`, `ProjectTask`, `Approval`, `Ticket`, `Message`, `StoredFile`, `Invoice`, `Payment`) and `ClientSubscription` from `../managed-services/types`.
- Produces (`serializers.ts`), each returns a plain object with exactly the listed keys:
  - `toProjectDto(p: Project)`: `id, code, name, summary, status, health, current_phase, progress, start_date, target_launch_date, actual_launch_date, created_at, updated_at`
  - `toMilestoneDto(m: Milestone)`: `id, project_id, name, description, owner_party, sort_order, status, starts_on, target_date, completed_on, deliverables, client_action, approval_required, approved_at, created_at, updated_at`
  - `toTaskDto(t: ProjectTask)`: `id, project_id, milestone_id, title, description, kind, assignee_party, status, due_at, completed_at, created_at, updated_at`
  - `toApprovalDto(a: Approval)`: `id, project_id, milestone_id, file_id, title, description, status, due_at, decided_at, decided_by_name, decision_note, created_at, updated_at`
  - `toTicketDto(t: Ticket)`: `id, number, project_id, category, priority, subject, description, status, opened_by_name, first_response_at, resolved_at, closed_at, resolution_notes, last_activity_at, created_at, updated_at`
  - `toMessageDto(m: Message)`: `id, ticket_id, author_type, author_name, body, created_at, edited_at` (callers must filter `internal` first)
  - `toFileDto(f: StoredFile)`: `id, project_id, milestone_id, ticket_id, name, description, category, size_bytes, mime_type, current_version, scan_status, created_at`
  - `toInvoiceDto(i: Invoice)`: `id, number, project_id, kind, status, currency, description, line_items, subtotal_cents, tax_cents, total_cents, amount_paid_cents, balance_cents (= total - paid), due_at, paid_at, created_at, updated_at`
  - `toPaymentDto(p: Payment)`: `id, invoice_id, provider, status, amount_cents, currency, method_summary, refunded_cents, received_at, created_at`
  - `toSubscriptionDto(s: ClientSubscription)`: `id, plan_key, plan_name, status, billing_frequency, monthly_price_cents, annual_price_cents, currency, included_hours, started_at, current_period_start, current_period_end, cancel_at_period_end`
  - `toBriefDto(b: BriefRow)` where `type BriefRow = { id: string; title: string; brief_type: string; executive_summary: string | null; content_markdown: string; brief_date: string; priority: string; status: string; received_at: string; created_at: string }` → same keys.
  - `DENYLIST = ["password_hash", "passwordHash", "configuration_encrypted", "key_hash", "secret", "mfa_secret", "mfaSecret", "notes", "storage_path", "token", "stripe_checkout_session_id", "stripe_payment_intent_id", "raw_payload", "internal"]`
- Produces (`ownership.ts`), pure:
  - `projectOwnedBy(project: { client_id: string } | null, clientId: string): boolean`
  - `ticketOwnedBy(ticket: { client_id: string } | null, clientId: string): boolean`
  - `fileOwnedBy(file: { client_id: string | null } | null, clientId: string): boolean`
  - `invoiceOwnedBy(inv: { client_id: string | null } | null, clientId: string): boolean`
  - `approvalOwnedBy(a: { client_id: string } | null, clientId: string): boolean`
  - `requireOwned<T>(row: T | null, owned: boolean): T` — throws `notFound()` when `row` is null or `!owned`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/apiv1-serializers.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as s from "../lib/apiv1/serializers.ts";
import { requireOwned, ticketOwnedBy, fileOwnedBy } from "../lib/apiv1/ownership.ts";

/** Feed every serializer an object that has every denylisted key set; none may survive. */
const poison = Object.fromEntries(s.DENYLIST.map((k) => [k, "LEAK"]));
const base = { id: "i", created_at: "t", updated_at: "t", client_id: "c", project_id: "p", currency: "usd" };

describe("serializers strip internal fields", () => {
  const cases: [string, (x: any) => Record<string, unknown>][] = [
    ["project", s.toProjectDto], ["milestone", s.toMilestoneDto], ["task", s.toTaskDto], ["approval", s.toApprovalDto],
    ["ticket", s.toTicketDto], ["message", s.toMessageDto], ["file", s.toFileDto], ["invoice", s.toInvoiceDto],
    ["payment", s.toPaymentDto], ["subscription", s.toSubscriptionDto], ["brief", s.toBriefDto],
  ];
  for (const [name, fn] of cases) {
    it(name, () => {
      const out = fn({ ...base, ...poison, total_cents: 10, amount_paid_cents: 4, line_items: [], deliverables: [] });
      for (const k of s.DENYLIST) assert.equal(k in out, false, `${name} leaked ${k}`);
      assert.equal(JSON.stringify(out).includes("LEAK"), false);
    });
  }
  it("invoice computes balance", () => {
    assert.equal(s.toInvoiceDto({ ...base, total_cents: 10, amount_paid_cents: 4, line_items: [] } as any).balance_cents, 6);
  });
});

describe("ownership", () => {
  it("guards", () => {
    assert.equal(ticketOwnedBy({ client_id: "c" }, "c"), true);
    assert.equal(ticketOwnedBy({ client_id: "c" }, "z"), false);
    assert.equal(fileOwnedBy({ client_id: null }, "c"), false);
    assert.throws(() => requireOwned(null, true), (e: any) => e.code === "not_found");
    assert.throws(() => requireOwned({ x: 1 }, false), (e: any) => e.status === 404);
    assert.deepEqual(requireOwned({ x: 1 }, true), { x: 1 });
  });
});
```

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement** both files exactly per the Interfaces (each `toXDto` is an explicit object literal picking the listed keys — no spreads). For `toInvoiceDto`, `balance_cents: (i.total_cents ?? 0) - (i.amount_paid_cents ?? 0)`. For `toSubscriptionDto`, map camelCase → snake_case keys as listed (`plan_key: s.planKey ?? null`, `plan_name: s.planName ?? null`, …). `ownership.ts`:

```ts
// lib/apiv1/ownership.ts
import { notFound } from "./errors";

export const projectOwnedBy = (p: { client_id: string } | null, clientId: string) => !!p && p.client_id === clientId;
export const ticketOwnedBy = (t: { client_id: string } | null, clientId: string) => !!t && t.client_id === clientId;
export const approvalOwnedBy = (a: { client_id: string } | null, clientId: string) => !!a && a.client_id === clientId;
export const fileOwnedBy = (f: { client_id: string | null } | null, clientId: string) => !!f && f.client_id === clientId;
export const invoiceOwnedBy = (i: { client_id: string | null } | null, clientId: string) => !!i && i.client_id === clientId;

/** 404 for both "missing" and "not yours" so other clients' ids stay unguessable. */
export function requireOwned<T>(row: T | null, owned: boolean): T {
  if (row === null || !owned) throw notFound();
  return row;
}
```

- [ ] **Step 4: Run — expect PASS; `npm run typecheck`.**

- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/serializers.ts lib/apiv1/ownership.ts tests/apiv1-serializers.test.ts
git commit -m "API platform: DTO serializers and ownership guards"
```

---

### Task 12: Cursor-paged list functions

**Files:**
- Create: `lib/lifecycle/paged.ts`
- Test: `tests/apiv1-paged.test.ts`

**Interfaces:**
- Consumes: `applyCursor`, `pageResult`, `Cursor` (Task 3).
- Produces (all take an injected `sb` so tests are hermetic; route code passes `requireSupabase()`):
  - `type PageOpts = { limit: number; cursor: Cursor | null }`
  - `type Page<T> = { data: T[]; next_cursor: string | null }`
  - `listProjectsPage(sb, clientId, opts: PageOpts & { status?: string })`
  - `listTicketsPage(sb, clientId, opts: PageOpts & { status?: string })`
  - `listFilesPage(sb, clientId, opts: PageOpts & { projectId?: string })`
  - `listInvoicesPage(sb, clientId, opts: PageOpts & { status?: string })`
  - `listPaymentsPage(sb, clientId, opts: PageOpts)`
  - `listBriefsPage(sb, clientId, opts: PageOpts)`
  - Each: `sb.from(table).select("*").eq("client_id", clientId)[.eq(filter)]` → `applyCursor` → `.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(opts.limit + 1)`; throws `Error(\`${fn}: ${error.message}\`)` on error; returns `pageResult(rows, opts.limit)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/apiv1-paged.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listTicketsPage, listFilesPage } from "../lib/lifecycle/paged.ts";
import { encodeCursor } from "../lib/apiv1/pagination.ts";

function fakeSb(rows: any[]) {
  const calls: string[] = [];
  const q: any = {};
  for (const m of ["select", "eq", "or", "order", "limit"]) q[m] = (...a: unknown[]) => { calls.push(`${m}:${a.join(",")}`); return q; };
  q.then = (r: any) => r({ data: rows, error: null });
  return { calls, sb: { from: (t: string) => { calls.push(`from:${t}`); return q; } } };
}

describe("paged lists", () => {
  it("scopes by client, filters, orders, fetches limit+1", async () => {
    const rows = [1, 2, 3].map((n) => ({ id: `i${n}`, created_at: `t${n}`, client_id: "c" }));
    const f = fakeSb(rows);
    const page = await listTicketsPage(f.sb as any, "c", { limit: 2, cursor: null, status: "open" });
    assert.equal(page.data.length, 2);
    assert.ok(page.next_cursor);
    assert.ok(f.calls.includes("from:tickets"));
    assert.ok(f.calls.includes("eq:client_id,c"));
    assert.ok(f.calls.includes("eq:status,open"));
    assert.ok(f.calls.includes("limit:3"));
    assert.ok(f.calls.some((c) => c.startsWith("order:created_at")));
  });
  it("applies the cursor and the project filter", async () => {
    const f = fakeSb([]);
    const cursor = { createdAt: "T", id: "I" };
    await listFilesPage(f.sb as any, "c", { limit: 5, cursor, projectId: "p1" });
    assert.ok(f.calls.includes("eq:project_id,p1"));
    assert.ok(f.calls.includes("or:created_at.lt.T,and(created_at.eq.T,id.lt.I)"));
    assert.ok(encodeCursor(cursor));
  });
});
```

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement**

```ts
// lib/lifecycle/paged.ts
/**
 * Cursor-paged list functions for the public API. Kept separate from the
 * existing list* helpers (which stay unpaged for the portal pages).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCursor, pageResult, type Cursor } from "../apiv1/pagination";
import type { Invoice, Payment, Project, StoredFile, Ticket } from "./types";
import type { BriefRow } from "../apiv1/serializers";

export type PageOpts = { limit: number; cursor: Cursor | null };
export type Page<T> = { data: T[]; next_cursor: string | null };

type Row = { id: string; created_at: string };

async function run<T extends Row>(
  fn: string,
  sb: SupabaseClient,
  table: string,
  clientId: string,
  opts: PageOpts,
  filters: Record<string, string | undefined>,
): Promise<Page<T>> {
  let q = sb.from(table).select("*").eq("client_id", clientId);
  for (const [col, val] of Object.entries(filters)) if (val) q = q.eq(col, val);
  q = applyCursor(q, opts.cursor);
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(opts.limit + 1);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return pageResult((data ?? []) as T[], opts.limit);
}

export const listProjectsPage = (sb: SupabaseClient, clientId: string, o: PageOpts & { status?: string }) =>
  run<Project>("listProjectsPage", sb, "projects", clientId, o, { status: o.status });
export const listTicketsPage = (sb: SupabaseClient, clientId: string, o: PageOpts & { status?: string }) =>
  run<Ticket>("listTicketsPage", sb, "tickets", clientId, o, { status: o.status });
export const listFilesPage = (sb: SupabaseClient, clientId: string, o: PageOpts & { projectId?: string }) =>
  run<StoredFile>("listFilesPage", sb, "files", clientId, o, { project_id: o.projectId });
export const listInvoicesPage = (sb: SupabaseClient, clientId: string, o: PageOpts & { status?: string }) =>
  run<Invoice>("listInvoicesPage", sb, "invoices", clientId, o, { status: o.status });
export const listPaymentsPage = (sb: SupabaseClient, clientId: string, o: PageOpts) =>
  run<Payment>("listPaymentsPage", sb, "payments", clientId, o, {});
export const listBriefsPage = (sb: SupabaseClient, clientId: string, o: PageOpts) =>
  run<BriefRow>("listBriefsPage", sb, "briefs", clientId, o, {});
```

- [ ] **Step 4: Run — expect PASS; `npm run typecheck`** (the `applyCursor` generic must accept the PostgREST builder type — if TS complains, cast: `q = applyCursor(q as unknown as { or(f: string): typeof q }, opts.cursor) as typeof q`).

- [ ] **Step 5: Commit**

```bash
git add lib/lifecycle/paged.ts tests/apiv1-paged.test.ts
git commit -m "API platform: cursor-paged list functions"
```

---

### Task 13: Projects, milestones, tasks, approvals routes

**Files:**
- Create: `lib/apiv1/resources/projects.ts`
- Create routes:
  - `app/api/v1/projects/route.ts`
  - `app/api/v1/projects/[id]/route.ts`
  - `app/api/v1/projects/[id]/milestones/[mid]/approve/route.ts`
  - `app/api/v1/projects/[id]/milestones/[mid]/request-changes/route.ts`
  - `app/api/v1/projects/[id]/tasks/[tid]/complete/route.ts`
  - `app/api/v1/approvals/[id]/decide/route.ts`
- Create: `lib/apiv1/client.ts` (helper)

**Interfaces:**
- `lib/apiv1/client.ts` produces `clientOf(principal: Principal | null): ClientPrincipal` — throws `ApiError(403,"insufficient_scope")` if not a client principal (defensive; pipeline already enforces).
- `lib/apiv1/resources/projects.ts` produces the handlers (each typed `ApiHandler<…>`) and zod schemas: `listProjects`, `getProject`, `approveMilestoneHandler`, `requestChangesHandler`, `completeTaskHandler`, `decideApprovalHandler`, plus `listQuery = z.object({ status: z.string().max(40).optional(), limit: z.string().optional(), cursor: z.string().optional() })`, `noteBody = z.object({ note: z.string().max(2000).optional() })`, `changesBody = z.object({ note: z.string().min(1).max(2000) })`, `decideBody = z.object({ decision: z.enum(["approved","changes_requested"]), note: z.string().max(2000).optional() })`.

- [ ] **Step 1: Helper**

```ts
// lib/apiv1/client.ts
import { ApiError } from "./errors";
import type { ClientPrincipal, Principal } from "./principal";

export function clientOf(principal: Principal | null): ClientPrincipal {
  if (!principal || principal.type !== "client") throw new ApiError(403, "insufficient_scope", "A client API key is required.");
  return principal;
}
```

- [ ] **Step 2: Resource module**

```ts
// lib/apiv1/resources/projects.ts
import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import { approveMilestone, computeHealth, computeProgress, getProjectWithDetail, requestMilestoneChanges, updateTask } from "@/lib/lifecycle/projects";
import { decideApproval, listApprovalsForClient } from "@/lib/lifecycle/workspace";
import { logClientActivity } from "@/lib/lifecycle/activity";
import { listProjectsPage } from "@/lib/lifecycle/paged";
import type { Approval, Milestone, ProjectTask } from "@/lib/lifecycle/types";
import { clientOf } from "../client";
import { ApiError } from "../errors";
import { parseListParams } from "../pagination";
import { approvalOwnedBy, projectOwnedBy, requireOwned } from "../ownership";
import { toApprovalDto, toMilestoneDto, toProjectDto, toTaskDto } from "../serializers";
import type { ApiHandler } from "../types";

export const listQuery = z.object({ status: z.string().max(40).optional(), limit: z.string().optional(), cursor: z.string().optional() });
export const noteBody = z.object({ note: z.string().max(2000).optional() });
export const changesBody = z.object({ note: z.string().min(1).max(2000) });
export const decideBody = z.object({ decision: z.enum(["approved", "changes_requested"]), note: z.string().max(2000).optional() });

export const listProjects: ApiHandler<undefined, z.infer<typeof listQuery>> = async ({ principal, query, request }) => {
  const c = clientOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listProjectsPage(requireSupabase(), c.portal.client.id, { limit, cursor, status: query.status });
  return { data: page.data.map(toProjectDto), meta: { next_cursor: page.next_cursor, limit } };
};

async function ownedProjectDetail(projectId: string, clientId: string) {
  const detail = await getProjectWithDetail(projectId);
  return requireOwned(detail, projectOwnedBy(detail?.project ?? null, clientId));
}

export const getProject: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const detail = await ownedProjectDetail(params.id!, c.portal.client.id);
  const approvals = (await listApprovalsForClient(c.portal.client.id)).filter((a) => a.project_id === detail.project.id && a.status === "pending");
  return {
    data: {
      ...toProjectDto(detail.project),
      progress: computeProgress(detail.milestones),
      health: computeHealth(detail.milestones),
      milestones: detail.milestones.map(toMilestoneDto),
      tasks: detail.tasks.map(toTaskDto),
      open_approvals: approvals.map(toApprovalDto),
    },
  };
};

async function ownedMilestone(projectId: string, milestoneId: string, clientId: string): Promise<Milestone> {
  const detail = await ownedProjectDetail(projectId, clientId);
  const m = detail.milestones.find((x) => x.id === milestoneId) ?? null;
  return requireOwned(m, m !== null);
}

export const approveMilestoneHandler: ApiHandler<z.infer<typeof noteBody>, undefined> = async ({ principal, params, body }) => {
  const c = clientOf(principal);
  const m = await ownedMilestone(params.id!, params.mid!, c.portal.client.id);
  if (m.status !== "under_review") throw new ApiError(409, "conflict", "This milestone isn't awaiting review.");
  const r = await approveMilestone(m.id, { approvedBy: c.keyName });
  await logClientActivity({ clientId: c.portal.client.id, projectId: m.project_id, actorType: "client", actorName: `${c.keyName} (API)`, action: `Approved milestone "${m.name}"${body.note ? `: "${body.note}"` : ""}`, entityType: "milestone", entityId: m.id });
  return { data: toMilestoneDto(r.milestone) };
};

export const requestChangesHandler: ApiHandler<z.infer<typeof changesBody>, undefined> = async ({ principal, params, body }) => {
  const c = clientOf(principal);
  const m = await ownedMilestone(params.id!, params.mid!, c.portal.client.id);
  if (m.status !== "under_review") throw new ApiError(409, "conflict", "This milestone isn't awaiting review.");
  const r = await requestMilestoneChanges(m.id, { note: `${c.keyName} (API): ${body.note}` });
  await logClientActivity({ clientId: c.portal.client.id, projectId: m.project_id, actorType: "client", actorName: `${c.keyName} (API)`, action: `Requested changes on "${m.name}"`, entityType: "milestone", entityId: m.id });
  return { data: toMilestoneDto(r.milestone) };
};

export const completeTaskHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const detail = await ownedProjectDetail(params.id!, c.portal.client.id);
  const task = detail.tasks.find((t) => t.id === params.tid) ?? null;
  const owned = requireOwned<ProjectTask>(task, task !== null);
  if (owned.assignee_party !== "client") throw new ApiError(409, "conflict", "This task belongs to the Redmont team.");
  if (owned.status === "done") return { data: toTaskDto(owned) };
  const updated = await updateTask(owned.id, { status: "done" });
  await logClientActivity({ clientId: c.portal.client.id, projectId: owned.project_id, actorType: "client", actorName: `${c.keyName} (API)`, action: `Completed "${owned.title}"`, entityType: "task", entityId: owned.id });
  return { data: toTaskDto(updated) };
};

export const decideApprovalHandler: ApiHandler<z.infer<typeof decideBody>, undefined> = async ({ principal, params, body }) => {
  const c = clientOf(principal);
  const all = await listApprovalsForClient(c.portal.client.id);
  const a = all.find((x) => x.id === params.id) ?? null;
  const owned = requireOwned<Approval>(a, approvalOwnedBy(a, c.portal.client.id));
  if (owned.status !== "pending") throw new ApiError(409, "conflict", "This approval has already been decided.");
  const decided = await decideApproval(owned.id, { decision: body.decision, decidedByClientUserId: null, decidedByName: `${c.keyName} (API)`, note: body.note });
  await logClientActivity({ clientId: c.portal.client.id, projectId: owned.project_id, actorType: "client", actorName: `${c.keyName} (API)`, action: `${body.decision === "approved" ? "Approved" : "Requested changes on"} "${owned.title}"`, entityType: "approval", entityId: owned.id });
  return { data: toApprovalDto(decided) };
};
```

Verify before writing: `updateTask` return type (`sed -n 849,880p lib/lifecycle/projects.ts`) — if it returns `void`, re-fetch via `getProjectWithDetail` and return the task from there. Verify `logClientActivity` input keys (`grep -n "export async function logClientActivity" -A 12 lib/lifecycle/activity.ts`) and `listApprovalsForClient` signature (`sed -n 324,338p lib/lifecycle/workspace.ts`). Adjust to match; the plan's shape mirrors `app/api/portal/project/route.ts`, which is the source of truth.

- [ ] **Step 3: Routes** (each file has the two `export const` runtime lines, `export const OPTIONS = options;`, and a single `api(...)` call). Example — repeat the pattern for all six:

```ts
// app/api/v1/projects/route.ts
import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { listProjects, listQuery } from "@/lib/apiv1/resources/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client", scopes: ["projects:read"], query: listQuery,
  meta: { operationId: "listProjects", summary: "List projects", tag: "Projects", response: z.any() },
}, listProjects);
export const OPTIONS = options;
```

| Route file | method | scopes | idempotent | body | handler | operationId |
|---|---|---|---|---|---|---|
| `projects/[id]/route.ts` | GET | `projects:read` | – | – | `getProject` | `getProject` |
| `…/milestones/[mid]/approve/route.ts` | POST | `projects:write` | yes | `noteBody` | `approveMilestoneHandler` | `approveMilestone` |
| `…/milestones/[mid]/request-changes/route.ts` | POST | `projects:write` | yes | `changesBody` | `requestChangesHandler` | `requestMilestoneChanges` |
| `…/tasks/[tid]/complete/route.ts` | POST | `projects:write` | yes | – | `completeTaskHandler` | `completeTask` |
| `approvals/[id]/decide/route.ts` | POST | `projects:write` | yes | `decideBody` | `decideApprovalHandler` | `decideApproval` |

`response: z.any()` is acceptable in Phase 1; Phase 4 tightens response schemas.

- [ ] **Step 4: Verify**

`npm run typecheck && npm run lint && npm test`. Manual smoke needs a key — that arrives in Task 17; record the curl commands to run then:
`curl -s -H "Authorization: Bearer $KEY" localhost:3000/api/v1/projects | jq` and `curl -s -X POST -H "Authorization: Bearer $KEY" -H "Idempotency-Key: demo-0001" localhost:3000/api/v1/projects/<id>/tasks/<tid>/complete`.

- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/client.ts lib/apiv1/resources/projects.ts app/api/v1/projects app/api/v1/approvals
git commit -m "API platform: project, milestone, task, approval endpoints"
```

---

### Task 14: Tickets routes

**Files:**
- Create: `lib/apiv1/resources/tickets.ts`
- Create routes: `app/api/v1/tickets/route.ts` (GET, POST), `app/api/v1/tickets/[id]/route.ts` (GET), `app/api/v1/tickets/[id]/messages/route.ts` (POST), `app/api/v1/tickets/[id]/reopen/route.ts` (POST), `app/api/v1/tickets/[id]/confirm-close/route.ts` (POST)

**Interfaces:**
- Consumes: `createTicket`, `getTicket`, `reopenTicket`, `confirmTicketClosure` from `@/lib/lifecycle/support`; `addMessage`, `listMessages` from `@/lib/lifecycle/workspace`; `listTicketsPage`; `TICKET_CATEGORY_LABELS` keys for the enum.
- Produces handlers `listTickets`, `getTicketHandler`, `createTicketHandler`, `addTicketMessage`, `reopenHandler`, `confirmCloseHandler`; schemas:
  - `createBody = z.object({ subject: z.string().min(1).max(200), body: z.string().min(1).max(20_000), category: z.enum([...keys of TICKET_CATEGORY_LABELS]).default("bug"), priority: z.enum(["low","normal","high","urgent","critical"]).default("normal"), project_id: z.string().uuid().optional() })`
  - `messageBody = z.object({ body: z.string().min(1).max(20_000) })`
  - `listQuery` as in Task 13.

- [ ] **Step 1: Resource module**

```ts
// lib/apiv1/resources/tickets.ts
import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import { confirmTicketClosure, createTicket, getTicket, reopenTicket, TICKET_CATEGORY_LABELS } from "@/lib/lifecycle/support";
import { addMessage, listMessages } from "@/lib/lifecycle/workspace";
import { listTicketsPage } from "@/lib/lifecycle/paged";
import { clientOf } from "../client";
import { ApiError } from "../errors";
import { parseListParams } from "../pagination";
import { requireOwned, ticketOwnedBy } from "../ownership";
import { toMessageDto, toTicketDto } from "../serializers";
import type { ApiHandler } from "../types";

const CATEGORY = Object.keys(TICKET_CATEGORY_LABELS) as [string, ...string[]];

export const listQuery = z.object({ status: z.string().max(40).optional(), limit: z.string().optional(), cursor: z.string().optional() });
export const createBody = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20_000),
  category: z.enum(CATEGORY).default("bug"),
  priority: z.enum(["low", "normal", "high", "urgent", "critical"]).default("normal"),
  project_id: z.string().uuid().optional(),
});
export const messageBody = z.object({ body: z.string().min(1).max(20_000) });

async function ownedTicket(id: string, clientId: string) {
  const t = await getTicket(id);
  return requireOwned(t, ticketOwnedBy(t, clientId));
}

export const listTickets: ApiHandler<undefined, z.infer<typeof listQuery>> = async ({ principal, query, request }) => {
  const c = clientOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listTicketsPage(requireSupabase(), c.portal.client.id, { limit, cursor, status: query.status });
  return { data: page.data.map(toTicketDto), meta: { next_cursor: page.next_cursor, limit } };
};

export const getTicketHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const t = await ownedTicket(params.id!, c.portal.client.id);
  const messages = await listMessages({ ticketId: t.id }, { includeInternal: false, limit: 500 });
  return { data: { ...toTicketDto(t), messages: messages.filter((m) => !m.internal).map(toMessageDto) } };
};

export const createTicketHandler: ApiHandler<z.infer<typeof createBody>, undefined> = async ({ principal, body }) => {
  const c = clientOf(principal);
  const t = await createTicket({
    clientId: c.portal.client.id,
    projectId: body.project_id ?? null,
    category: body.category as keyof typeof TICKET_CATEGORY_LABELS,
    priority: body.priority,
    subject: body.subject,
    description: body.body,
    openedByClientUserId: null,
    openedByName: `${c.keyName} (API)`,
  });
  return { data: toTicketDto(t), status: 201 };
};

export const addTicketMessage: ApiHandler<z.infer<typeof messageBody>, undefined> = async ({ principal, params, body }) => {
  const c = clientOf(principal);
  const t = await ownedTicket(params.id!, c.portal.client.id);
  if (t.status === "closed") throw new ApiError(409, "conflict", "This ticket is closed. Reopen it first.");
  const m = await addMessage({ clientId: c.portal.client.id, ticketId: t.id, projectId: t.project_id, authorType: "client", authorClientUserId: null, authorName: `${c.keyName} (API)`, body: body.body });
  return { data: toMessageDto(m), status: 201 };
};

export const reopenHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const t = await ownedTicket(params.id!, c.portal.client.id);
  if (!["resolved", "closed"].includes(t.status)) throw new ApiError(409, "conflict", "Only resolved or closed tickets can be reopened.");
  return { data: toTicketDto(await reopenTicket(t.id)) };
};

export const confirmCloseHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const t = await ownedTicket(params.id!, c.portal.client.id);
  if (t.status !== "resolved") throw new ApiError(409, "conflict", "Only resolved tickets can be closed.");
  return { data: toTicketDto(await confirmTicketClosure(t.id)) };
};
```

Verify the exact `TicketStatus` values used for the 409 checks (`sed -n 844,864p lib/lifecycle/types.ts`) and how `app/api/portal/support/route.ts` guards `reopen`/`confirm_close`; mirror those exactly. Verify `project_id` ownership when supplied: load via `getProject` and `projectOwnedBy`, else 422 `validation_failed` `{ project_id: ["unknown project"] }`.

- [ ] **Step 2: Routes** — same pattern as Task 13:

| Route file | method | scopes | idempotent | body/query | handler | operationId |
|---|---|---|---|---|---|---|
| `tickets/route.ts` | GET | `tickets:read` | – | `listQuery` | `listTickets` | `listTickets` |
| `tickets/route.ts` | POST | `tickets:write` | yes | `createBody` | `createTicketHandler` | `createTicket` |
| `tickets/[id]/route.ts` | GET | `tickets:read` | – | – | `getTicketHandler` | `getTicket` |
| `tickets/[id]/messages/route.ts` | POST | `tickets:write` | yes | `messageBody` | `addTicketMessage` | `addTicketMessage` |
| `tickets/[id]/reopen/route.ts` | POST | `tickets:write` | yes | – | `reopenHandler` | `reopenTicket` |
| `tickets/[id]/confirm-close/route.ts` | POST | `tickets:write` | yes | – | `confirmCloseHandler` | `confirmTicketClosure` |

- [ ] **Step 3: Verify** `npm run typecheck && npm run lint && npm test`.

- [ ] **Step 4: Commit**

```bash
git add lib/apiv1/resources/tickets.ts app/api/v1/tickets
git commit -m "API platform: ticket endpoints"
```

---

### Task 15: Briefs and files routes

**Files:**
- Create: `lib/apiv1/resources/briefs.ts`, `lib/apiv1/resources/files.ts`
- Create routes: `app/api/v1/briefs/route.ts` (GET, POST), `app/api/v1/briefs/[id]/route.ts` (GET), `app/api/v1/files/route.ts` (GET), `app/api/v1/files/[id]/route.ts` (GET), `app/api/v1/files/[id]/download/route.ts` (GET)

**Interfaces:**
- Consumes: `BriefPayloadSchema` from `@/lib/briefs/schema`, `ingestBrief` from `@/lib/briefs/ingest`, `getSupabase`; `getFile`, `getDownloadUrl` from `@/lib/lifecycle/files`; `listBriefsPage`, `listFilesPage`.
- Produces: `listBriefs`, `getBriefHandler`, `createBriefHandler`; `listFiles`, `getFileHandler`, `downloadFile`; `filesQuery = z.object({ project_id: z.string().uuid().optional(), limit: z.string().optional(), cursor: z.string().optional() })`.

- [ ] **Step 1: Briefs**

```ts
// lib/apiv1/resources/briefs.ts
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { requireSupabase } from "@/lib/lifecycle/core";
import { BriefPayloadSchema } from "@/lib/briefs/schema";
import { ingestBrief } from "@/lib/briefs/ingest";
import { listBriefsPage } from "@/lib/lifecycle/paged";
import { clientOf } from "../client";
import { ApiError, notFound } from "../errors";
import { parseListParams } from "../pagination";
import { toBriefDto, type BriefRow } from "../serializers";
import type { ApiHandler } from "../types";

export const listQuery = z.object({ limit: z.string().optional(), cursor: z.string().optional() });
export const createBody = BriefPayloadSchema;

export const listBriefs: ApiHandler<undefined, z.infer<typeof listQuery>> = async ({ principal, request }) => {
  const c = clientOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listBriefsPage(requireSupabase(), c.portal.client.id, { limit, cursor });
  return { data: page.data.map(toBriefDto), meta: { next_cursor: page.next_cursor, limit } };
};

export const getBriefHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const { data } = await requireSupabase().from("briefs").select("*").eq("id", params.id!).eq("client_id", c.portal.client.id).maybeSingle();
  if (!data) throw notFound();
  return { data: toBriefDto(data as BriefRow) };
};

export const createBriefHandler: ApiHandler<z.infer<typeof createBody>, undefined> = async ({ principal, body, request }) => {
  const c = clientOf(principal);
  const db = getSupabase();
  if (!db) throw new ApiError(503, "unavailable", "Brief storage is not configured.");
  // The pipeline already required Idempotency-Key; reuse it for the ingest RPC's own dedupe.
  const idem = request.headers.get("idempotency-key")!.trim();
  const result = await ingestBrief(body, `client:${c.portal.client.id}:${idem}`, "api");
  if (!result.duplicate) {
    await db.from("briefs").update({ client_id: c.portal.client.id }).eq("id", result.briefId);
  }
  const { data } = await db.from("briefs").select("*").eq("id", result.briefId).maybeSingle();
  if (!data) throw notFound();
  return { data: toBriefDto(data as BriefRow), status: result.duplicate ? 200 : 201 };
};
```

Verify `ingestBrief` return shape (`sed -n 19,60p lib/briefs/ingest.ts`): the plan assumes `{ duplicate: boolean; briefId: string; requestId: string }` as used by `app/api/briefs/ingest/route.ts`.

- [ ] **Step 2: Files**

```ts
// lib/apiv1/resources/files.ts
import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import { getDownloadUrl, getFile } from "@/lib/lifecycle/files";
import { listFilesPage } from "@/lib/lifecycle/paged";
import { clientOf } from "../client";
import { parseListParams } from "../pagination";
import { fileOwnedBy, requireOwned } from "../ownership";
import { toFileDto } from "../serializers";
import type { ApiHandler } from "../types";

export const filesQuery = z.object({ project_id: z.string().uuid().optional(), limit: z.string().optional(), cursor: z.string().optional() });

export const listFiles: ApiHandler<undefined, z.infer<typeof filesQuery>> = async ({ principal, query, request }) => {
  const c = clientOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listFilesPage(requireSupabase(), c.portal.client.id, { limit, cursor, projectId: query.project_id });
  return { data: page.data.map(toFileDto), meta: { next_cursor: page.next_cursor, limit } };
};

async function ownedFile(id: string, clientId: string) {
  const f = await getFile(id);
  return requireOwned(f, fileOwnedBy(f, clientId));
}

export const getFileHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  return { data: toFileDto(await ownedFile(params.id!, c.portal.client.id)) };
};

export const downloadFile: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const f = await ownedFile(params.id!, c.portal.client.id);
  const { url, name, sizeBytes } = await getDownloadUrl(f.id);
  return { status: 302, headers: { Location: url }, data: { url, name, size_bytes: sizeBytes, expires_in_seconds: 300 } };
};
```

Check `getDownloadUrl`'s signed-URL TTL (`sed -n 323,365p lib/lifecycle/files.ts`) and set `expires_in_seconds` to match. Files with `scan_status` not `clean` (check the `FileScanStatus` union) must not be downloadable: throw `ApiError(409, "conflict", "File is not available for download yet.")`.

- [ ] **Step 3: Routes**

| Route file | method | scopes | idempotent | body/query | handler | operationId |
|---|---|---|---|---|---|---|
| `briefs/route.ts` | GET | `briefs:read` | – | `listQuery` | `listBriefs` | `listBriefs` |
| `briefs/route.ts` | POST | `briefs:write` | yes | `createBody` | `createBriefHandler` | `createBrief` |
| `briefs/[id]/route.ts` | GET | `briefs:read` | – | – | `getBriefHandler` | `getBrief` |
| `files/route.ts` | GET | `files:read` | – | `filesQuery` | `listFiles` | `listFiles` |
| `files/[id]/route.ts` | GET | `files:read` | – | – | `getFileHandler` | `getFile` |
| `files/[id]/download/route.ts` | GET | `files:read` | – | – | `downloadFile` | `downloadFile` |

- [ ] **Step 4: Verify** `npm run typecheck && npm run lint && npm test`.

- [ ] **Step 5: Commit**

```bash
git add lib/apiv1/resources/briefs.ts lib/apiv1/resources/files.ts app/api/v1/briefs app/api/v1/files
git commit -m "API platform: brief and file endpoints"
```

---

### Task 16: Billing routes

**Files:**
- Create: `lib/apiv1/resources/billing.ts`
- Create routes: `app/api/v1/invoices/route.ts`, `app/api/v1/invoices/[id]/route.ts`, `app/api/v1/payments/route.ts`, `app/api/v1/subscription/route.ts`

**Interfaces:**
- Consumes: `getInvoice` from `@/lib/lifecycle/billing`, `getActiveSubscriptionForClient` from `@/lib/managed-services/store`, `listInvoicesPage`, `listPaymentsPage`.
- Produces: `listInvoices`, `getInvoiceHandler`, `listPayments`, `getSubscription`.

- [ ] **Step 1: Implement**

```ts
// lib/apiv1/resources/billing.ts
import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import { getInvoice } from "@/lib/lifecycle/billing";
import { listInvoicesPage, listPaymentsPage } from "@/lib/lifecycle/paged";
import { getActiveSubscriptionForClient } from "@/lib/managed-services/store";
import { clientOf } from "../client";
import { parseListParams } from "../pagination";
import { invoiceOwnedBy, requireOwned } from "../ownership";
import { toInvoiceDto, toPaymentDto, toSubscriptionDto } from "../serializers";
import type { ApiHandler } from "../types";

export const invoicesQuery = z.object({ status: z.string().max(40).optional(), limit: z.string().optional(), cursor: z.string().optional() });
export const pageQuery = z.object({ limit: z.string().optional(), cursor: z.string().optional() });

export const listInvoices: ApiHandler<undefined, z.infer<typeof invoicesQuery>> = async ({ principal, query, request }) => {
  const c = clientOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listInvoicesPage(requireSupabase(), c.portal.client.id, { limit, cursor, status: query.status });
  return { data: page.data.map(toInvoiceDto), meta: { next_cursor: page.next_cursor, limit } };
};

export const getInvoiceHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const inv = await getInvoice(params.id!);
  return { data: toInvoiceDto(requireOwned(inv, invoiceOwnedBy(inv, c.portal.client.id))) };
};

export const listPayments: ApiHandler<undefined, z.infer<typeof pageQuery>> = async ({ principal, request }) => {
  const c = clientOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listPaymentsPage(requireSupabase(), c.portal.client.id, { limit, cursor });
  return { data: page.data.map(toPaymentDto), meta: { next_cursor: page.next_cursor, limit } };
};

export const getSubscription: ApiHandler<undefined, undefined> = async ({ principal }) => {
  const c = clientOf(principal);
  const sub = await getActiveSubscriptionForClient(c.portal.client.id);
  return { data: sub ? toSubscriptionDto(sub) : null };
};
```

- [ ] **Step 2: Routes**

| Route file | method | scopes | query | handler | operationId |
|---|---|---|---|---|---|
| `invoices/route.ts` | GET | `billing:read` | `invoicesQuery` | `listInvoices` | `listInvoices` |
| `invoices/[id]/route.ts` | GET | `billing:read` | – | `getInvoiceHandler` | `getInvoice` |
| `payments/route.ts` | GET | `billing:read` | `pageQuery` | `listPayments` | `listPayments` |
| `subscription/route.ts` | GET | `billing:read` | – | `getSubscription` | `getSubscription` |

- [ ] **Step 3: Verify** `npm run typecheck && npm run lint && npm test`.

- [ ] **Step 4: Commit**

```bash
git add lib/apiv1/resources/billing.ts app/api/v1/invoices app/api/v1/payments app/api/v1/subscription
git commit -m "API platform: billing endpoints"
```

---

### Task 17: Key store + cookie-auth key management routes

**Files:**
- Create: `lib/apiv1/key-store.ts`
- Create: `app/api/portal/apikeys/route.ts` (GET, POST), `app/api/portal/apikeys/[id]/route.ts` (DELETE), `app/api/admin/apikeys/route.ts` (GET, POST), `app/api/admin/apikeys/[id]/route.ts` (DELETE)
- Test: `tests/apiv1-key-store.test.ts`

**Interfaces:**
- Consumes: `generateApiKey`, `ApiKeyRow` (Task 5), `capAdminScopes`, `isClientScope` (Task 4).
- Produces (`key-store.ts`, `sb` injected):
  - `MAX_ACTIVE_KEYS = 10`
  - `type KeyOwner = { type: "client" | "admin"; id: string }`
  - `type ApiKeyDto = { id, name, key_prefix, scopes, created_by, last_used_at, expires_at, created_at, requests_30d: number }`
  - `createApiKey(sb, input: { owner: KeyOwner; name: string; scopes: string[]; createdBy: string }): Promise<{ key: ApiKeyDto; plaintext: string }>` — throws `ApiError(409,"conflict")` when active count ≥ 10; throws `ApiError(422,"validation_failed",…,{ scopes: [...] })` when `scopes` empty.
  - `listApiKeys(sb, owner: KeyOwner): Promise<ApiKeyDto[]>` — active only, with `requests_30d` from one `api_requests` query grouped in JS.
  - `revokeApiKey(sb, owner: KeyOwner, id: string): Promise<boolean>` — sets `revoked_at` where `id`+owner match and not already revoked; returns whether a row changed.
  - `toApiKeyDto(row: ApiKeyRow, requests30d: number): ApiKeyDto`

Supabase calls used: `from("api_keys").select("*").eq("principal_type").eq("principal_id").is("revoked_at", null).order("created_at", { ascending: false })`; `.insert({...}).select("*").single()`; `.update({ revoked_at }).eq("id").eq("principal_type").eq("principal_id").is("revoked_at", null).select("id")`; `from("api_requests").select("key_id").in("key_id", ids).gte("created_at", iso30dAgo)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/apiv1-key-store.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApiKey, listApiKeys, revokeApiKey, MAX_ACTIVE_KEYS } from "../lib/apiv1/key-store.ts";
import { KEY_PREFIX } from "../lib/apiv1/keys.ts";

function fakeSb(state: { keys: any[]; requests: any[] }) {
  const builder = (table: string) => {
    let rows = table === "api_keys" ? state.keys : state.requests;
    let pendingUpdate: any = null;
    const q: any = {};
    q.select = () => q;
    q.eq = (c: string, v: unknown) => { rows = rows.filter((r) => r[c] === v); return q; };
    q.is = (c: string, v: unknown) => { rows = rows.filter((r) => r[c] === v); return q; };
    q.in = (c: string, vs: unknown[]) => { rows = rows.filter((r) => vs.includes(r[c])); return q; };
    q.gte = () => q;
    q.order = () => q;
    q.insert = (v: any) => { const row = { id: `id${state.keys.length + 1}`, created_at: "t", last_used_at: null, expires_at: null, revoked_at: null, ...v }; state.keys.push(row); rows = [row]; return q; };
    q.update = (v: any) => { pendingUpdate = v; return q; };
    q.single = async () => ({ data: rows[0], error: null });
    q.then = (res: any) => { if (pendingUpdate) { for (const r of rows) Object.assign(r, pendingUpdate); } res({ data: rows, error: null }); };
    return q;
  };
  return { from: builder } as any;
}

describe("key-store", () => {
  const owner = { type: "client" as const, id: "c1" };
  it("creates, lists with 30d counts, revokes", async () => {
    const state = { keys: [] as any[], requests: [] as any[] };
    const sb = fakeSb(state);
    const { key, plaintext } = await createApiKey(sb, { owner, name: "CI", scopes: ["projects:read"], createdBy: "ann@acme.com" });
    assert.ok(plaintext.startsWith(KEY_PREFIX));
    assert.equal(key.key_prefix.length, 8);
    assert.equal("key_hash" in key, false);
    state.requests.push({ key_id: key.id }, { key_id: key.id });
    const list = await listApiKeys(sb, owner);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.requests_30d, 2);
    assert.equal(await revokeApiKey(sb, owner, key.id), true);
    assert.equal((await listApiKeys(sb, owner)).length, 0);
    assert.equal(await revokeApiKey(sb, { type: "client", id: "other" }, key.id), false);
  });
  it("enforces the active-key cap and non-empty scopes", async () => {
    const state = { keys: Array.from({ length: MAX_ACTIVE_KEYS }, (_, i) => ({ id: `k${i}`, principal_type: "client", principal_id: "c1", revoked_at: null })), requests: [] };
    await assert.rejects(createApiKey(fakeSb(state), { owner, name: "x", scopes: ["projects:read"], createdBy: "a" }), (e: any) => e.code === "conflict");
    await assert.rejects(createApiKey(fakeSb({ keys: [], requests: [] }), { owner, name: "x", scopes: [], createdBy: "a" }), (e: any) => e.code === "validation_failed");
  });
});
```

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement**

```ts
// lib/apiv1/key-store.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./errors";
import { generateApiKey, type ApiKeyRow } from "./keys";

export const MAX_ACTIVE_KEYS = 10;

export type KeyOwner = { type: "client" | "admin"; id: string };

export type ApiKeyDto = {
  id: string; name: string; key_prefix: string; scopes: string[]; created_by: string;
  last_used_at: string | null; expires_at: string | null; created_at: string; requests_30d: number;
};

export function toApiKeyDto(row: ApiKeyRow, requests30d: number): ApiKeyDto {
  return {
    id: row.id, name: row.name, key_prefix: row.key_prefix, scopes: [...row.scopes], created_by: row.created_by,
    last_used_at: row.last_used_at, expires_at: row.expires_at, created_at: row.created_at, requests_30d: requests30d,
  };
}

async function activeRows(sb: SupabaseClient, owner: KeyOwner): Promise<ApiKeyRow[]> {
  const { data, error } = await sb
    .from("api_keys").select("*")
    .eq("principal_type", owner.type).eq("principal_id", owner.id).is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listApiKeys: ${error.message}`);
  return (data ?? []) as ApiKeyRow[];
}

export async function createApiKey(
  sb: SupabaseClient,
  input: { owner: KeyOwner; name: string; scopes: string[]; createdBy: string },
): Promise<{ key: ApiKeyDto; plaintext: string }> {
  if (input.scopes.length === 0) throw new ApiError(422, "validation_failed", "Choose at least one scope.", { scopes: ["required"] });
  const existing = await activeRows(sb, input.owner);
  if (existing.length >= MAX_ACTIVE_KEYS) throw new ApiError(409, "conflict", `You can have at most ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`);
  const gen = generateApiKey();
  const { data, error } = await sb
    .from("api_keys")
    .insert({ principal_type: input.owner.type, principal_id: input.owner.id, name: input.name, key_prefix: gen.prefix, key_hash: gen.hash, scopes: input.scopes, created_by: input.createdBy })
    .select("*").single();
  if (error || !data) throw new Error(`createApiKey: ${error?.message ?? "no row"}`);
  return { key: toApiKeyDto(data as ApiKeyRow, 0), plaintext: gen.plaintext };
}

export async function listApiKeys(sb: SupabaseClient, owner: KeyOwner): Promise<ApiKeyDto[]> {
  const rows = await activeRows(sb, owner);
  if (rows.length === 0) return [];
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const { data } = await sb.from("api_requests").select("key_id").in("key_id", rows.map((r) => r.id)).gte("created_at", since);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { key_id: string }[]) counts.set(r.key_id, (counts.get(r.key_id) ?? 0) + 1);
  return rows.map((r) => toApiKeyDto(r, counts.get(r.id) ?? 0));
}

export async function revokeApiKey(sb: SupabaseClient, owner: KeyOwner, id: string): Promise<boolean> {
  const { data, error } = await sb
    .from("api_keys").update({ revoked_at: new Date().toISOString() })
    .eq("id", id).eq("principal_type", owner.type).eq("principal_id", owner.id).is("revoked_at", null)
    .select("id");
  if (error) throw new Error(`revokeApiKey: ${error.message}`);
  return (data ?? []).length > 0;
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Portal routes**

```ts
// app/api/portal/apikeys/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalContext, canManageTeam } from "@/lib/lifecycle/access";
import { requireSupabase } from "@/lib/lifecycle/core";
import { logClientActivity } from "@/lib/lifecycle/activity";
import { isSupabaseConfigured } from "@/lib/supabase";
import { apiPlatformEnabled } from "@/lib/env";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { createApiKey, listApiKeys } from "@/lib/apiv1/key-store";
import { CLIENT_SCOPES, isClientScope } from "@/lib/apiv1/scopes";
import { ApiError } from "@/lib/apiv1/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.string()).min(1).max(CLIENT_SCOPES.length).refine((s) => s.every(isClientScope), "Unknown scope."),
});

async function guard() {
  if (!apiPlatformEnabled() || !isSupabaseConfigured()) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const ctx = await requirePortalContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!canManageTeam(ctx.user.role)) return NextResponse.json({ error: "Only account owners and admins can manage API keys." }, { status: 403 });
  return ctx;
}

export async function GET() {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;
  const keys = await listApiKeys(requireSupabase(), { type: "client", id: ctx.client.id });
  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;
  if (!(await rateLimit(`portal-apikeys:${ctx.client.id}:${clientIp(request)}`, 20, 10 * 60_000))) return rateLimitResponse();
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 422 });
  try {
    const { key, plaintext } = await createApiKey(requireSupabase(), { owner: { type: "client", id: ctx.client.id }, name: parsed.data.name, scopes: parsed.data.scopes, createdBy: ctx.user.email });
    await logClientActivity({ clientId: ctx.client.id, actorType: "client", actorName: ctx.user.name, action: `Created API key "${key.name}"`, entityType: "api_key", entityId: key.id });
    return NextResponse.json({ key, plaintext }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    throw err;
  }
}
```

```ts
// app/api/portal/apikeys/[id]/route.ts
import { NextResponse } from "next/server";
import { requirePortalContext, canManageTeam } from "@/lib/lifecycle/access";
import { requireSupabase } from "@/lib/lifecycle/core";
import { logClientActivity } from "@/lib/lifecycle/activity";
import { isSupabaseConfigured } from "@/lib/supabase";
import { apiPlatformEnabled } from "@/lib/env";
import { revokeApiKey } from "@/lib/apiv1/key-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  if (!apiPlatformEnabled() || !isSupabaseConfigured()) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const ctx = await requirePortalContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!canManageTeam(ctx.user.role)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const { id } = await context.params;
  const ok = await revokeApiKey(requireSupabase(), { type: "client", id: ctx.client.id }, id);
  if (!ok) return NextResponse.json({ error: "Key not found." }, { status: 404 });
  await logClientActivity({ clientId: ctx.client.id, actorType: "client", actorName: ctx.user.name, action: "Revoked an API key", entityType: "api_key", entityId: id });
  return NextResponse.json({ ok: true });
}
```

Check `logClientActivity`'s required fields (`projectId` may be required — pass `null` if so).

- [ ] **Step 6: Admin routes** — same shape with `requireAdmin()` (no permission arg; any admin), owner `{ type: "admin", id: ctx.admin.id }`, scopes validated with `capAdminScopes(parsed.data.scopes, ctx.role)` → if `rejected.length` return 422 `{ error: "Some scopes exceed your permissions.", details: { scopes: rejected } }`. Listing: if `can("manage_team", ctx.role)` list keys for **all** admins (`sb.from("api_keys").select("*").eq("principal_type","admin").is("revoked_at",null)` — add `listAllAdminKeys(sb)` to `key-store.ts` returning `ApiKeyDto & { principal_id: string }[]` using the same 30-day count helper), else only their own. Revoke: `manage_team` may revoke any admin key (add `revokeAnyAdminKey(sb, id)` to `key-store.ts`), else only own. Write `writeAuditEvent({ actorType: "admin", actorId: ctx.admin.id, actorEmail: ctx.admin.email, action: "apikey.create" | "apikey.revoke", entityType: "api_key", entityId })` on both. Also add `apikey.create`/`apikey.revoke` via `writeAuditEvent` with `actorType: "system"`, `actorEmail: ctx.user.email`, `metadata: { client_id }` in the portal routes (no `"client"` actor type exists in `AuditActorType`; do not widen it in this task).

- [ ] **Step 7: Verify** `npm test && npm run typecheck && npm run lint`. Smoke with the dev server: log into the portal as a test client, `POST /api/portal/apikeys` via the browser console using `postJson` from `lib/api.ts`, copy the plaintext, then run the Task 13 curls.

- [ ] **Step 8: Commit**

```bash
git add lib/apiv1/key-store.ts tests/apiv1-key-store.test.ts app/api/portal/apikeys app/api/admin/apikeys
git commit -m "API platform: key store and portal/admin key-management routes"
```

---

### Task 18: Portal "Developers" page

**Files:**
- Create: `components/portal/ApiKeysView.tsx`, `app/portal/developers/page.tsx`
- Modify: `components/portal/PortalShell.tsx:42-51` (NAV) and `:75` (member gating)

- [ ] **Step 1: Page**

```tsx
// app/portal/developers/page.tsx
import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requirePortalPage } from "@/lib/lifecycle/portal-page";
import { canManageTeam } from "@/lib/lifecycle/access";
import { requireSupabase } from "@/lib/lifecycle/core";
import { apiPlatformEnabled } from "@/lib/env";
import { listApiKeys } from "@/lib/apiv1/key-store";
import { CLIENT_SCOPES } from "@/lib/apiv1/scopes";
import { PortalShell } from "@/components/portal/PortalShell";
import { ApiKeysView } from "@/components/portal/ApiKeysView";
import { PageHeader } from "@/components/portal/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Developers | Client Portal", robots: { index: false, follow: false } };

export default async function DevelopersPage() {
  if (!apiPlatformEnabled()) notFound();
  const ctx = await requirePortalPage();
  if (!canManageTeam(ctx.user.role)) redirect("/portal");
  const keys = await listApiKeys(requireSupabase(), { type: "client", id: ctx.client.id }).catch(() => []);
  return (
    <PortalShell company={ctx.client.company} userName={ctx.user.name} role={ctx.user.role}>
      <PageHeader eyebrow="Developers" title="API keys" description="Connect your own tools to your Redmont workspace. Keys are shown once; store them somewhere safe." />
      <ApiKeysView initialKeys={keys} scopes={[...CLIENT_SCOPES]} endpoint="/api/portal/apikeys" />
    </PortalShell>
  );
}
```

- [ ] **Step 2: View component** (`"use client"`). Props: `{ initialKeys: ApiKeyDto[]; scopes: string[]; endpoint: string }`. Uses `postJson` from `@/lib/api` and `fetch(endpoint + "/" + id, { method: "DELETE", headers: { "x-csrf-token": getCsrfToken() } })`, `SectionCard`, `Button`, `Modal`, `EmptyState`, `Banner` from `@/components/portal/ui`. Structure:
  - Header row: count + "Create key" `Button`.
  - Table (wrap in `<div className="overflow-x-auto">`): Name · Prefix (`rsg_live_<prefix>…` in `font-mono`) · Scopes (chips) · Last used (relative, `—` if null) · Requests (30d) · Revoke (`variant="danger"`, confirm via `Modal`).
  - Create `Modal`: name input (`maxLength=80`), scope checkboxes grouped by resource (`projects`, `tickets`, `briefs`, `files`, `billing`, `webhooks`), submit → on 201 switch the modal to a "Copy your key" state showing `plaintext` in a read-only `<input>` with a Copy button (`navigator.clipboard.writeText`) and the warning "This is the only time we'll show it." On 409/422 show `Banner` with the error.
  - Empty state: "No API keys yet." with the create button.
  - All interactive elements have accessible names; tap targets ≥ 44px (match existing portal buttons).
- [ ] **Step 3: Nav** — `PortalShell` is a client component, so it reads `process.env.NEXT_PUBLIC_API_PLATFORM_ENABLED === "true"` (inlined at build time). Add `{ href: "/portal/developers", label: "Developers", icon: KeyRound }` (import `KeyRound` from `lucide-react`) after Team, filtered out when that flag is not `"true"`, and extend the member gate to `(item.href === "/portal/billing" || item.href === "/portal/team" || item.href === "/portal/developers") && role === "member"`. Add `NEXT_PUBLIC_API_PLATFORM_ENABLED=` to `.env.example` directly under `API_PLATFORM_ENABLED=` with the comment `# Must match API_PLATFORM_ENABLED; controls the portal/admin nav entries.`
- [ ] **Step 4: Verify** `npm run typecheck && npm run lint && npm run build`. Then with both env vars set: `npm run dev`, log in to the portal, open `/portal/developers`, create a key, copy it, revoke it. Add `/portal/developers` to `scripts/audit-responsive.mjs`'s route list and run `npm run audit:responsive` — 0 clipped elements, 0 tap-target failures for that route.
- [ ] **Step 5: Commit**

```bash
git add components/portal/ApiKeysView.tsx app/portal/developers/page.tsx components/portal/PortalShell.tsx scripts/audit-responsive.mjs .env.example
git commit -m "API platform: portal Developers page for API keys"
```

---

### Task 19: Admin "API keys" tab

**Files:**
- Create: `components/admin/ApiKeysAdminPanel.tsx`
- Modify: `components/admin/AdminConsole.tsx` (`Tab` union, tab list, panel switch), `app/admin/page.tsx` (`caps.apiKeys`)

- [ ] **Step 1:** In `app/admin/page.tsx` add `apiKeys: apiPlatformEnabled()` to `caps` (import from `@/lib/env`); in `AdminConsole.tsx` add `"api-keys"` to `Tab`, `apiKeys: boolean` to `AdminCaps`, a tab entry `{ id: "api-keys", label: "API keys", icon: KeyRound, count: null, badge: 0 }` rendered only when `caps.apiKeys`, and the panel branch `tab === "api-keys" && caps.apiKeys ? <ApiKeysAdminPanel scopes={ADMIN_SCOPES} /> : …`. Import `ADMIN_SCOPES` from `@/lib/apiv1/scopes` (pure module; safe in a client component).
- [ ] **Step 2:** Extract the table + create/revoke modals from Task 18's `ApiKeysView` into `components/shared/ApiKeysManager.tsx` (`"use client"`), props `{ endpoint: string; scopes: string[]; allowedScopes?: string[]; extraColumns?: { header: string; render: (k: ApiKeyDto & Record<string, unknown>) => ReactNode }[] }`; `ApiKeysView` becomes a thin wrapper. Extend `GET /api/admin/apikeys` to return `{ keys, allowed_scopes: scopesAllowedFor(ctx.role) }` and (for `manage_team`) include `principal_id` and `created_by` on each key. `ApiKeysAdminPanel.tsx` (`"use client"`) fetches that on mount, renders `ApiKeysManager` with `allowedScopes` (checkboxes outside it are disabled with `title="Your role doesn't include this scope"`) and extra columns "Created by" and, when `manage_team`, "Owner" (`principal_id`).
- [ ] **Step 3: Verify** `npm run typecheck && npm run lint && npm run build`; dev-server smoke as an admin: create an admin key with `leads:read`, `GET /api/v1/me` with it → `principal: "admin"`; `GET /api/v1/projects` with it → 403 `insufficient_scope`. Run `npm run audit:responsive` including `/admin` with the tab open if the script supports a post-navigation action; otherwise verify manually at 375px width.
- [ ] **Step 4: Commit**

```bash
git add components/admin/ApiKeysAdminPanel.tsx components/shared/ApiKeysManager.tsx components/portal/ApiKeysView.tsx components/admin/AdminConsole.tsx app/admin/page.tsx
git commit -m "API platform: admin API keys tab"
```

---

### Task 20: Cron cleanup, docs, final verification

**Files:**
- Modify: `app/api/cron/scheduling/route.ts` (add cleanup step)
- Create: `lib/apiv1/cleanup.ts`
- Create: `docs/api-platform.md`
- Test: `tests/apiv1-cleanup.test.ts`

**Interfaces:**
- `cleanupApiTables(sb, now = Date.now()): Promise<{ idempotency: number; requests: number }>` — deletes `api_idempotency` rows with `created_at < now - 24h` and `api_requests` rows `created_at < now - 30d`; uses `.delete().lt("created_at", iso).select("*", { count: "exact", head: true })` — verify the exact count idiom against an existing delete in `lib/` (`grep -rn "count: \"exact\"" lib | head`) and mirror it.

- [ ] **Step 1: Test**

```ts
// tests/apiv1-cleanup.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanupApiTables } from "../lib/apiv1/cleanup.ts";

describe("cleanupApiTables", () => {
  it("uses the documented cutoffs", async () => {
    const calls: string[] = [];
    const sb = { from: (t: string) => { const q: any = {}; q.delete = () => q; q.lt = (c: string, v: string) => { calls.push(`${t}:${c}:${v}`); return q; }; q.select = () => q; q.then = (r: any) => r({ count: 2, error: null }); return q; } } as any;
    const now = Date.parse("2026-09-15T00:00:00.000Z");
    const r = await cleanupApiTables(sb, now);
    assert.deepEqual(r, { idempotency: 2, requests: 2 });
    assert.ok(calls.includes("api_idempotency:created_at:2026-09-14T00:00:00.000Z"));
    assert.ok(calls.includes("api_requests:created_at:2026-08-16T00:00:00.000Z"));
  });
});
```

- [ ] **Step 2: Implement** `lib/apiv1/cleanup.ts` per the interface; then in the cron route, after the existing steps, `const apiCleanup = await cleanupApiTables(sb).catch((e) => ({ error: String(e) }))` and include it in the JSON summary the route already returns (read the route first: `sed -n 1,80p app/api/cron/scheduling/route.ts`).
- [ ] **Step 3: Docs** — `docs/api-platform.md` (repo root `docs/`): what shipped in Phase 1, env vars (`API_PLATFORM_ENABLED`, `NEXT_PUBLIC_API_PLATFORM_ENABLED`), how to mint a key, the curl quick-start, error codes, pagination, idempotency, rate limits, and a pointer to the spec. Keep it under 150 lines.
- [ ] **Step 4: Full verification**

```bash
npm test && npm run typecheck && npm run lint && npm run build
```

All green. Then the end-to-end smoke in one sitting with the flag on: create client key → `/me` → list projects → complete a task (twice with the same Idempotency-Key; second is replayed) → list tickets → create ticket → add message → list files → download (302) → invoices → subscription → revoke key → `/me` returns 401. Record the transcript in the PR description.

- [ ] **Step 5: Commit and open the PR**

```bash
git add lib/apiv1/cleanup.ts tests/apiv1-cleanup.test.ts app/api/cron/scheduling/route.ts docs/api-platform.md
git commit -m "API platform: cron cleanup and docs"
git push -u origin feat/api-platform
gh pr create --base main --title "API platform Phase 1: keys, pipeline, client resources" --body-file pr-body.md
rm pr-body.md
```

Write `pr-body.md` first (in `Website/`, not committed) with these sections: **Spec** (link `docs/superpowers/specs/2026-09-15-api-platform-design.md`); **Endpoints** (the table of every `/api/v1` route from Tasks 10, 13–16); **Env** — set `API_PLATFORM_ENABLED` and `NEXT_PUBLIC_API_PLATFORM_ENABLED` in Vercel Preview only, leave Production unset until Phase 2; **Migration** — `20260915120000_api_platform.sql` already applied to `dyajmgddsiqcnlehqbhl`; **Verification** — the `npm test` / typecheck / lint / build output summary and the smoke transcript from Step 4; **Known deviation** — no `X-RateLimit-*` headers yet. End with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
