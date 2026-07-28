# Webhooks

Everything RSG sends outbound goes through one pipeline: `lib/webhooks/outbox.ts`.
Two kinds of destination use it, differing only in payload and endpoint:

| kind | destination | producer |
|---|---|---|
| `client` | a subscriber's URL in `webhook_endpoints` | `enqueueWebhook()` from booking / qualification / reminders |
| `registry` | a per-app Supabase project's `registry-sync` function | `lib/webhooks/registry-sync.ts` |

Inbound webhooks we *receive* (Stripe) are separate — see
`app/api/stripe/webhook/route.ts`, which is already replay-guarded by
`claimStripeEvent(event.id)` before any processing.

---

## 1. What a receiver gets

```http
POST /your/endpoint
Content-Type: application/json
x-rsg-signature: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
x-rsg-timestamp: 1785206654102
x-correlation-id: 4f9a…
X-RSG-Event: booking.created
X-RSG-Sequence: 41
Idempotency-Key: booking.created:2f1c…

{
  "id": "booking.created:2f1c…",
  "type": "booking.created",
  "sequence": 41,
  "created_at": "2026-07-28T03:17:00.000Z",
  "data": { "bookingId": "2f1c…", "leadId": "8ab2…", "startsAt": "…" }
}
```

### Verify the signature

```
expected = HMAC_SHA256(your_secret, "{x-rsg-timestamp}.{raw_request_body}")
```

Hex-encoded, compared to `x-rsg-signature` **in constant time**.

Three rules that are not optional:

- **Sign the raw bytes.** Re-serialising parsed JSON changes key order and
  whitespace, and the signature stops matching.
- **Reject a timestamp more than 5 minutes old.** The timestamp is inside the
  signed material specifically so it cannot be rewritten — a signature with no
  freshness check is valid forever, which is what makes captured requests
  replayable.
- **Compare in constant time.** `==` leaks how many leading characters matched.

Reference implementations: `lib/webhooks/sign.ts` (sender + verifier) and
`shared/supabase/functions/registry-sync/index.ts` (a receiver).

### Dedupe on `Idempotency-Key`

Delivery is **at-least-once**. If our process dies between sending and recording
the result, you get the event again. The key is stable across every retry of the
same domain event, so:

> Record the key before you act on the event. If you have seen it, return 200 and
> do nothing.

Returning 200 for a duplicate is correct — it is not an error, and treating it as
one makes us retry something you already processed.

### Ordering

`X-RSG-Sequence` is monotonic **per endpoint**. Events are attempted in sequence
order, but a failed event backs off while later ones proceed, so arrival order
can still differ from production order. There is deliberately no head-of-line
blocking — one poisoned event must not freeze your entire stream.

Use the sequence to *detect* a gap or a reorder. Do not assume it never happens.

### Your response

| you return | we do |
|---|---|
| `2xx` | mark delivered, done |
| `408`, `429` | retry with backoff (`Retry-After` honoured, capped at 1h) |
| other `4xx` | **give up immediately** — dead-letter it |
| `5xx`, timeout, connection error | retry with backoff |

A `4xx` means the request is wrong; repeating it unchanged cannot succeed. If you
return `400` for a transient problem, you will lose the event.

Retry schedule: exponential with full jitter, up to 8 attempts, capped at one
hour between attempts. Roughly 2s → 4s → 8s → … → 1h, randomised.

---

## 2. Operating it

### When an endpoint has been broken

Deliveries dead-letter after 8 attempts (or immediately on a permanent 4xx).
After fixing the endpoint:

```ts
import { replayDeadLetters } from "@/lib/webhooks/outbox";

await replayDeadLetters({ endpointId: "…", since: new Date("2026-07-01") });
```

Replay resets the attempt counter — it is a deliberate decision made after the
cause was addressed, so it gets a fresh budget rather than one attempt against an
exhausted one.

### Monitoring

`outboxHealth()` returns `{ pending, sending, dead, oldestPendingAgeSeconds }`.

**`oldestPendingAgeSeconds` is the number that matters.** Counts alone look
healthy right up until they do not; a steadily climbing oldest-pending age is
what a stopped cron looks like. Alert on it, not on `pending`.

Dead letters are also reported through `recordDeadLettered()` into the
integration log, so they surface alongside every other provider failure rather
than only in this table.

### Delivery is driven by cron

- `/api/cron/scheduling` every 5 minutes — claims and delivers a batch, releases
  claims orphaned by workers that died mid-flight, and drains client tombstones.
- `/api/cron/registry` daily at 03:17 — reconciles the client registry.

If the cron stops firing, nothing delivers and nothing errors. That is why the
scheduling route records a heartbeat *before* doing any work.

---

## 3. Registry sync specifics

The website is the source of truth for who a client is; each app project keeps a
read-only mirror. See `docs/per-app-supabase.md` §2 for the topology.

- **Version, not timestamp.** `clients.registry_version` is bumped by a trigger
  only when `name` or `status` changes — not on every dashboard refresh. The
  receiver applies an event only if `version` is greater than what it holds, so
  out-of-order delivery settles correctly with no coordination.
- **Deletion is an event.** Clients are hard-deleted, so an `AFTER DELETE`
  trigger writes `client_registry_tombstones`. Without it a deleted client would
  simply stop being mentioned and live on in five app databases forever.
- **Push plus reconcile.** Push handles latency; the nightly sweep handles what
  was dropped while an app project was paused. Do not rely on push alone — a
  paused project errors for days, by which time every delivery for it has
  dead-lettered and nothing else would retry them.

### Registering an app destination

Once its Supabase project exists:

```ts
import { registerAppDestination } from "@/lib/webhooks/registry-sync";

await registerAppDestination({
  app: "observatory",
  projectRef: "…",
  secret: process.env.REGISTRY_SYNC_SECRET_OBSERVATORY!,
});
```

The secret must match that project's `REGISTRY_SYNC_SECRET` and must be
**distinct per app** — one shared secret across five projects means one leak
compromises all five.
