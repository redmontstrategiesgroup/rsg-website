# RSG Executive Intelligence Dashboard

## Architecture

`/dashboard` is a dynamic, server-authorized Next.js App Router route. It reuses
the website's existing signed administrator session and reads private dashboard
records through the server-only Supabase service-role client. Browser code never
receives a Supabase secret or queries dashboard tables directly.

The normalized ingestion flow is:

1. A sender posts JSON to `POST /api/briefs/ingest`.
2. The route verifies the bearer secret, rate limit, idempotency key, and Zod schema.
3. The `ingest_executive_brief` database function writes the brief and related
   sections, actions, opportunities, risks, intelligence, sources, tags, log,
   and notification in one transaction.
4. AI- or automation-extracted actions and opportunities enter review state.

Manual entries use the same normalizer through `/api/dashboard/briefs`.

## Database and RLS

Apply `supabase/migrations/20260712210451_executive_intelligence_dashboard.sql`.
It creates the normalized dashboard schema, constraints, foreign-key indexes,
audit records, ingestion logs, and atomic ingestion function.

RLS is enabled on every dashboard table. `anon` receives no grants or policies.
The existing application validates its private admin cookie before using the
service role server-side. Future Supabase Auth users are authorized only when
the immutable `app_metadata.role` claim equals `admin`; user-editable metadata
is never used. Profile role changes are not granted to authenticated clients.

## Environment

Required in production:

```env
AUTH_SECRET=<long-random-cookie-signing-secret>
ADMIN_EMAIL=<administrator-email>
ADMIN_PASSWORD=<strong-administrator-password>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
BRIEF_INGESTION_SECRET=<24+-character-random-secret>
```

## Webhook example

```bash
curl -X POST "https://example.com/api/briefs/ingest" \
  -H "Authorization: Bearer REPLACE_WITH_SECRET" \
  -H "Idempotency-Key: daily-executive-2026-07-12" \
  -H "Content-Type: application/json" \
  --data '{
    "title":"RSG Daily Executive Intelligence Brief",
    "briefType":"daily_executive",
    "briefDate":"2026-07-12",
    "generatedAt":"2026-07-12T08:00:00-04:00",
    "executiveSummary":"Summary content",
    "contentMarkdown":"# Full Brief",
    "sections":[],"actions":[],"opportunities":[],"risks":[],
    "intelligence":[],"sources":[],"tags":[]
  }'
```

Reuse the same idempotency key when retrying the same delivery. A successful
retry returns the existing brief identifier without creating a duplicate.

## Gmail and Google Calendar adapters

The deployed website cannot and should not reuse OAuth tokens from local IDE
or connector apps. `lib/integrations/brief-adapters.ts` defines the
provider-neutral adapter contract.

For Gmail/email ingestion, configure a dedicated mailbox or inbound-email
provider, an OAuth client or signed webhook secret, an allowlist of senders, and
the destination address. The adapter must validate the provider signature and
sender before normalizing the message.

For Google Calendar context, configure a separate Google OAuth client, client
secret, refresh token, and calendar ID. Calendar data should enrich an existing
brief or scheduling workflow; it should not fabricate a brief when no calendar
evidence exists.

## Adding a brief type or adapter

Add payload fields to `lib/briefs/schema.ts`, update the atomic SQL normalizer,
and add a validation test. New adapters implement `BriefIngestionAdapter`,
verify their own provider credentials, return the normalized `BriefPayload`, and
call the same secure server-side ingestion function.

## Operations

- Back up Supabase through the project's database backup controls before major schema changes.
- Review `/dashboard` Settings for failed or duplicate ingestion attempts.
- Rotate the ingestion secret if it is exposed; update all senders together.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only and never add a `NEXT_PUBLIC_` prefix.
- Development seed data is not used by the dashboard.
