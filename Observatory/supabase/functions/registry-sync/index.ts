// ============================================================================
// `registry-sync` — apply a client-registry change pushed from the website.
//
// Canonical copy: shared/supabase/functions/registry-sync/index.ts
// Vendored to:    <app>/supabase/functions/registry-sync/index.ts
//
// The website is the source of truth for who a client is. It pushes changes
// here; this function applies them to THIS project's rsg_clients mirror.
//
// The website deliberately does NOT hold this project's service-role key. Five
// service-role keys sitting in one app's env is the credential blast radius the
// per-project split exists to avoid. Instead the caller proves itself with an
// HMAC over the raw body, and this function uses its own service role — which
// never leaves this project (docs/per-app-supabase.md §2).
//
// Deploy:  supabase functions deploy registry-sync --no-verify-jwt
//          (--no-verify-jwt is correct here: the caller is a server, not a
//           logged-in user, and it authenticates by signature instead.)
// Secrets: supabase secrets set REGISTRY_SYNC_SECRET=<distinct per app>
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_SKEW_MS = 5 * 60 * 1000; // reject anything older than 5 minutes

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}

const enc = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time compare. A plain === leaks how much of the signature matched
// via timing, which is enough to forge one given enough attempts.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface SyncEvent {
  event_id: string;
  client_id: string;
  version: number;
  name?: string;
  status?: string;
  deleted?: boolean;
}

/**
 * Accept either a bare event / array of events, or the outbox envelope the
 * website's sender produces:
 *
 *   { id, type, sequence, created_at, data: { client_id, version, … } }
 *
 * The envelope's `id` IS the event id — it is the same value the sender used as
 * the outbox dedupe key, so a redelivery of the same envelope collapses here
 * too. Supporting the bare form as well keeps this callable by hand during
 * setup and replay without having to fabricate an envelope.
 */
function unwrap(parsed: unknown): SyncEvent[] {
  if (Array.isArray(parsed)) return parsed.flatMap(unwrap);
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (o.data && typeof o.data === "object") {
      return [{ event_id: String(o.id ?? ""), ...(o.data as object) } as SyncEvent];
    }
    return [o as unknown as SyncEvent];
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const secret = Deno.env.get("REGISTRY_SYNC_SECRET");
  if (!secret) {
    console.error("REGISTRY_SYNC_SECRET not set — refusing all sync");
    return json({ error: "sync not configured" }, 503);
  }

  // Read the RAW body: the signature covers the exact bytes sent. Re-serialising
  // parsed JSON changes key order and whitespace, and the signature stops matching.
  const raw = await req.text();

  const sig = req.headers.get("x-rsg-signature") ?? "";
  const ts = req.headers.get("x-rsg-timestamp") ?? "";

  const tsNum = Number(ts);
  if (!ts || Number.isNaN(tsNum) || Math.abs(Date.now() - tsNum) > MAX_SKEW_MS) {
    return json({ error: "stale or missing timestamp" }, 401);
  }

  // Timestamp is inside the signed payload — otherwise an attacker can replay a
  // captured body with a fresh timestamp header.
  const expected = await hmacHex(secret, `${ts}.${raw}`);
  if (!safeEqual(sig, expected)) return json({ error: "bad signature" }, 401);

  let events: SyncEvent[];
  try {
    events = unwrap(JSON.parse(raw));
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (events.length > 500) return json({ error: "batch too large (max 500)" }, 413);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: { event_id: string; applied: boolean; reason?: string }[] = [];

  for (const ev of events) {
    if (!ev?.event_id || !ev?.client_id || typeof ev.version !== "number") {
      results.push({ event_id: ev?.event_id ?? "?", applied: false, reason: "malformed" });
      continue;
    }

    // Idempotency: a redelivered event_id is a no-op, not a re-apply.
    //
    // The error is checked, not discarded. Discarding it made a failed lookup
    // indistinguishable from "not seen before", so dedupe failed OPEN — every
    // redelivery re-applied. A ledger you cannot read is not a ledger; 5xx so
    // the sender retries instead.
    const { data: seen, error: seenErr } = await admin
      .from("rsg_registry_events").select("event_id").eq("event_id", ev.event_id).maybeSingle();
    if (seenErr) {
      console.error("idempotency lookup failed", { event_id: ev.event_id, error: seenErr.message });
      return json({ error: "idempotency ledger unavailable", event_id: ev.event_id }, 503);
    }
    if (seen) {
      results.push({ event_id: ev.event_id, applied: false, reason: "duplicate" });
      continue;
    }

    const { data: current } = await admin
      .from("rsg_clients").select("version").eq("id", ev.client_id).maybeSingle();

    // Out-of-order delivery: only move forward. An older event arriving late
    // must not roll back newer state.
    const stale = current != null && Number(current.version) >= ev.version;

    if (!stale) {
      const { error: upErr } = await admin.from("rsg_clients").upsert({
        id: ev.client_id,
        name: ev.name ?? "(unnamed)",
        status: ev.status ?? "active",
        version: ev.version,
        deleted_at: ev.deleted ? new Date().toISOString() : null,
        synced_at: new Date().toISOString(),
      }, { onConflict: "id" });

      if (upErr) {
        // Do NOT record the event as seen — a failed apply must stay retryable,
        // and returning 5xx is what tells the sender to back off and retry.
        console.error("registry upsert failed", { event_id: ev.event_id, error: upErr.message });
        return json({ error: "upsert failed", event_id: ev.event_id }, 500);
      }
    }

    // Recording the event is what makes the NEXT delivery a no-op. If this
    // insert fails the apply already happened, so returning 5xx would have the
    // sender retry an unledgered event forever — but staying silent means
    // dedupe is quietly not running. Log loudly and keep going; the version
    // check is the second line of defence that makes a re-apply harmless.
    // A duplicate-key error here is the benign race (two deliveries in flight)
    // and is expected, not a fault.
    const { error: ledgerErr } = await admin.from("rsg_registry_events").insert({
      event_id: ev.event_id,
      client_id: ev.client_id,
      version: ev.version,
      applied: !stale,
    });
    if (ledgerErr && ledgerErr.code !== "23505") {
      console.error("IDEMPOTENCY LEDGER WRITE FAILED — dedupe is degraded", {
        event_id: ev.event_id, error: ledgerErr.message,
      });
    }

    results.push({ event_id: ev.event_id, applied: !stale, reason: stale ? "stale" : undefined });
  }

  return json({ ok: true, results }, 200);
});
