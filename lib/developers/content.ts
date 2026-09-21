/**
 * Prose for the public `/developers` reference. The repo has no markdown
 * pipeline, so sections are plain data: paragraphs, optional code, optional
 * table. Endpoint documentation is NOT here — it is generated from the
 * OpenAPI document (see `lib/apiv1/openapi.ts`).
 */

export type ProseSection = {
  id: string;
  title: string;
  paragraphs: string[];
  code?: { lang: string; body: string };
  table?: { head: string[]; rows: string[][] };
};

export const PROSE_SECTIONS: ProseSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    paragraphs: [
      "The Redmont Strategies Group API is a versioned JSON API under /api/v1. Client keys read and act on one client's projects, tickets, briefs, files and billing; admin keys work across leads, clients, proposals and the dashboard. A handful of public endpoints (booking, catalog, lead submission, status) need no key at all.",
      "Every successful response is an object with a data field. List responses add meta.next_cursor and meta.limit. Every error is an object with an error field — see Errors.",
      "The full machine-readable contract is available as OpenAPI 3.1 at /api/v1/openapi.json; point any generator at it.",
    ],
    code: {
      lang: "bash",
      body: `curl https://redmontstrategiesgroup.com/api/v1/me \\
  -H "Authorization: Bearer rsg_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"`,
    },
  },
  {
    id: "authentication",
    title: "Authentication",
    paragraphs: [
      "Send your key as a bearer token: Authorization: Bearer rsg_live_…. Client keys are created in the portal under Developers; admin keys in the admin dashboard under API keys. The plaintext is shown once, at creation. Keys can be given an expiry and are revocable at any time.",
      "Each key carries a set of scopes chosen when it is minted. An operation lists the scope it needs; calling it with a key that lacks the scope returns 403 insufficient_scope. Admin scopes are capped by the role of the admin who mints the key.",
      "GET /api/v1/me returns the principal behind the calling key — useful to confirm a key is wired up correctly.",
    ],
    table: {
      head: ["Key type", "Scopes"],
      rows: [
        ["Client", "projects:read, projects:write, tickets:read, tickets:write, briefs:read, briefs:write, files:read, billing:read, webhooks:manage"],
        ["Admin", "leads:read, leads:write, clients:read, proposals:read, dashboard:read, dashboard:write, audit:read, analytics:read, webhooks:manage"],
      ],
    },
  },
  {
    id: "errors",
    title: "Errors",
    paragraphs: [
      "Errors use one envelope: { \"error\": { \"code\", \"message\", \"details?\", \"correlation_id\" } }. The correlation_id is also returned in the x-correlation-id response header on every response, success or not — quote it when reporting a problem. validation_failed responses carry field-level details.",
    ],
    table: {
      head: ["Code", "HTTP", "Meaning"],
      rows: [
        ["unauthenticated", "401", "Missing, invalid, expired or revoked key"],
        ["insufficient_scope", "403", "Key lacks the required scope"],
        ["not_found", "404", "Resource missing, or not owned by the caller"],
        ["validation_failed", "422", "Request body or query failed validation"],
        ["rate_limited", "429", "Too many requests in the current window (Retry-After is set)"],
        ["idempotency_required", "400", "Mutating request is missing (or has a malformed) Idempotency-Key"],
        ["idempotency_mismatch", "422", "Same Idempotency-Key, different request"],
        ["conflict", "409", "State conflict, or a request with this Idempotency-Key is still in flight"],
        ["unavailable", "503", "The API is disabled or its backing store is unreachable"],
        ["internal", "500", "Unexpected error — the correlation_id is logged"],
      ],
    },
  },
  {
    id: "pagination",
    title: "Pagination",
    paragraphs: [
      "List endpoints accept limit (1–100, default 25) and cursor. The response's meta.next_cursor is an opaque token; pass it back as cursor to fetch the next page. It is null on the last page. Cursors are ordered by creation time, newest first, and are stable across inserts.",
    ],
    code: {
      lang: "bash",
      body: `curl "https://redmontstrategiesgroup.com/api/v1/tickets?limit=50" -H "Authorization: Bearer rsg_live_…"
# → { "data": [ … ], "meta": { "next_cursor": "MjAyNi0w…", "limit": 50 } }
curl "https://redmontstrategiesgroup.com/api/v1/tickets?limit=50&cursor=MjAyNi0w…" -H "Authorization: Bearer rsg_live_…"`,
    },
  },
  {
    id: "idempotency",
    title: "Idempotency",
    paragraphs: [
      "Operations marked idempotent (every POST that creates something) require an Idempotency-Key header of 8–200 characters — a UUID is ideal. Retrying with the same key and the same request returns the original response, with Idempotent-Replayed: true. The same key with a different body returns 422 idempotency_mismatch; reusing a key while the first request is still running returns 409 conflict. Keys are remembered for 24 hours and are scoped to the calling key.",
    ],
  },
  {
    id: "rate-limits",
    title: "Rate limits",
    paragraphs: [
      "Keyed requests are limited to 600 per 10 minutes per key; keyless requests to 60 per 10 minutes per IP. A few endpoints carry a tighter, endpoint-specific limit — it is shown on the operation below. Exceeding a limit returns 429 rate_limited with a Retry-After header. Requests that fail authentication count against the IP bucket.",
    ],
  },
  {
    id: "webhooks",
    title: "Webhooks",
    paragraphs: [
      "Subscribe an HTTPS endpoint to events with the webhook management operations (webhooks:manage). Each endpoint has its own secret (whsec_…), shown once at creation and rotatable. Client endpoints receive only events about that client; admin endpoints receive everything they subscribe to, with client_id in data.",
      "Every delivery is a POST with a JSON body { id, type, sequence, created_at, data } and is signed: x-rsg-signature is the hex HMAC-SHA256 of \"<x-rsg-timestamp>.<raw body>\" using the endpoint secret. Reject deliveries whose timestamp is more than five minutes old. Deliveries are at-least-once — dedupe on id (also sent as Idempotency-Key). X-RSG-Sequence is monotonic per endpoint.",
      "Respond with any 2xx to acknowledge. Anything else, or a timeout after 10 seconds, is retried with exponential backoff and jitter for up to 8 attempts (capped at an hour apart); after that the delivery is dead-lettered and can be replayed from the API or the portal. An endpoint that fails 20 deliveries in a row is disabled automatically. The events, their audiences and payload schemas are listed in the Webhook events section below.",
    ],
    code: {
      lang: "js",
      body: `import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(req, rawBody, secret) {
  const ts = req.headers["x-rsg-timestamp"];
  const sig = req.headers["x-rsg-signature"];
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = createHmac("sha256", secret).update(\`\${ts}.\${rawBody}\`).digest("hex");
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}`,
    },
  },
];
