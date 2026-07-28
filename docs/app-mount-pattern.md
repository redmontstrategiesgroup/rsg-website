# App-mount pattern

How to mount one of the RSG apps (Observatory, THE FORGE, NEXUS, Onehand OS, GHOST)
as an **authenticated, tenant-scoped product** inside this platform. Follow this so
every app is consistent and no app re-implements auth, tenancy, AI custody, or metering.

The tenant is the signed-in **portal client** (`clients.id`). Everything an app stores
and every AI call it makes is scoped by that `clientId`.

## 1. Routes

- **Page** (server component): `app/portal/<app>/page.tsx`
  ```tsx
  import { requireAppPage } from "@/lib/apps/context";
  export const runtime = "nodejs";
  export const metadata = { robots: { index: false } };

  export default async function Page() {
    const { clientId, ctx } = await requireAppPage(); // redirects to /login if signed out
    return <AppClient clientId={clientId} name={ctx.client.name} />; // a "use client" component
  }
  ```
  Client-only apps (three.js / canvas / vanilla ports) load via
  `next/dynamic(() => import("..."), { ssr: false })`.

- **API**: `app/api/portal/<app>/<route>/route.ts`
  ```ts
  import { requireAppApi, isAppContext } from "@/lib/apps/context";
  import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
  import { requireSupabase } from "@/lib/lifecycle/core";
  export const runtime = "nodejs";

  export async function POST(request: Request) {
    const auth = await requireAppApi();
    if (!isAppContext(auth)) return auth; // 401/503 already shaped
    const { clientId } = auth;
    if (!(await rateLimit(`<app>:${clientId}:${clientIp(request)}`, 120, 10 * 60_000))) {
      return rateLimitResponse();
    }
    const body = schema.parse(await request.json()); // zod — never trust the client
    const sb = requireSupabase();
    const { data } = await sb.from("<app>_things").select("*").eq("client_id", clientId); // ALWAYS scope
    return Response.json({ things: data ?? [] });
  }
  ```
  All mutating browser calls must send the CSRF header — use `postJson`/`patchJson` from `@/lib/api`.

## 2. Tables

One migration per app, `supabase/migrations/<timestamp>_<app>.sql`, following the
house convention (see `ai_usage` for a worked example):

```sql
create table if not exists public.<app>_things (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  -- ... app columns ...
  created_at timestamptz not null default now()
);
create index if not exists <app>_things_client_idx on public.<app>_things (client_id);
alter table public.<app>_things enable row level security;
revoke all on table public.<app>_things from anon, authenticated;
```

RLS is enabled with **no policies** and anon/authenticated revoked: access is
service-role only, and isolation is enforced by **always** filtering on
`client_id` in code. The service-role key bypasses RLS — forgetting the
`.eq("client_id", clientId)` filter is a cross-tenant leak; the database will not
catch it. Verify ownership on every by-id fetch (`row.client_id === clientId`).

## 3. AI

Never call Anthropic from the browser and never call `lib/ai/proxy` directly from a
route. Go through `@/lib/apps/ai`, which adds the per-tenant cap check + usage
metering automatically:

```ts
import { appGenerateStructured } from "@/lib/apps/ai";
const result = await appGenerateStructured<MyShape>({
  clientId, app: "<app>", system, input, schema,
});
// or appStreamText(...) for streaming replies
// map AiError with aiErrorResponse(err) from @/lib/ai/proxy
```

## 4. Seed / demo data

New tenants start **empty**. Any sample/demo data loads only behind an explicit
"load sample" action, never automatically — a demo record must never appear in a
real account. `NEXT_PUBLIC_ENABLE_DEMO_DATA` must be `false`/unset in production.

## 5. Acceptance (per app)

Sign in as tenant A, use the app, refresh — state persists. Sign in as a **second**
tenant B — B sees none of A's data, and A sees none of B's. That cross-tenant check
is the test the standalone demos never had.
