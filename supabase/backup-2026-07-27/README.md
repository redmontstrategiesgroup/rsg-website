# RSG Supabase backup — 2026-07-27

Full logical backup of the live Supabase project, pulled through the connected
management API (read-only) on **2026-07-27**.

- **Source project:** `rsg website` — ref `xnhbrfbuvssxpciikhws`
  (`https://xnhbrfbuvssxpciikhws.supabase.co`)
- **Org:** `redmont strategies group` (`hauyxdkkeycbzoyizrdz`), Pro plan
- **Postgres:** 17.x · region us-east-2

## Files

| File | What it is |
|------|-----------|
| `schema.sql` | Full `public` schema DDL — run this **first** |
| `data.sql`   | All row data as `json_populate_recordset` inserts — run **after** schema |

## Inventory (captured & verified)

- **104** tables, **2** views, **18** enum types, **7** extensions
- **350** constraints (PK/unique/check/exclude + FK), **116** indexes
- **15** functions, **23** triggers
- RLS enabled on all **104** tables, **142** policies
- **467** rows of data across **46** non-empty tables (biggest: `rsg_audit_log` 88, `rsg_call_turns` 61)

Every count above was cross-checked against a live census, and every data payload
was re-parsed as valid JSON, at capture time.

## What is NOT in here (and why that's fine)

- **`auth` and `storage` system schemas** — these are created automatically by every
  new Supabase project. At capture time there were **0 auth users**, **0 storage
  buckets/objects**, and **0 edge functions**, so nothing is lost.
- **Secrets** — the DB only stores integration *config* (the *names* of env vars like
  `TWILIO_AUTH_TOKEN`, never their values). After restoring, re-set the actual secrets
  as environment variables in your host (Vercel).

## Restore into a NEW Supabase project

1. Create the new project, open the **SQL Editor** (run as the `postgres` owner).
2. Paste and run **`schema.sql`**.
3. Paste and run **`data.sql`**.
   - It wraps the load in a transaction and sets `session_replication_role = replica`
     so foreign-key checks, `updated_at` touch triggers, and the audit trigger are
     suppressed during load (preserves original timestamps and avoids spurious audit rows).
4. Update your app's env vars to point at the new project:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (and re-set integration secrets).

### Verify after restore

```sql
select
 (select count(*) from pg_class where relnamespace='public'::regnamespace and relkind='r') as tables,   -- expect 104
 (select count(*) from pg_policies where schemaname='public') as policies,                              -- expect 142
 (select count(*) from public.rsg_audit_log) as audit_rows,                                             -- expect 88
 (select count(*) from public.rsg_call_turns) as call_turns;                                            -- expect 61
```

## Important caveat — repo migrations ≠ this backup

The migration files in `basic website/supabase/migrations/` do **not** reproduce the
live database (they were applied through different tooling and omit the whole `rsg_*`
voice-agent/CRM subsystem, which holds most of the real data). **This backup — not the
repo migrations — is the authoritative copy of the live schema + data.** Rebuild from
these two files, not from the migration folder.

## How it was produced

Logical export via SQL introspection over the Supabase management API
(`pg_get_functiondef`, `pg_get_constraintdef`, `pg_indexes`, `pg_policies`,
`json_agg` for data). No direct Postgres/`pg_dump` access was available. Once you
regain dashboard access, `supabase db dump` is the cleaner tool for future backups.
