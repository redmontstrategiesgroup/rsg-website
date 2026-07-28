import { requireSupabase } from "@/lib/scheduling/db";
import { enqueue, replayDeadLetters } from "./outbox";

/**
 * Client registry sender — the website half of the per-app Supabase split.
 *
 * The website is the source of truth for who a client is. Each app project
 * (`rsg-ghost`, `rsg-nexus`, …) keeps a read-only mirror in its `rsg_clients`
 * table, applied by its `registry-sync` edge function. This module produces the
 * events that feed it. See docs/per-app-supabase.md §2.
 *
 * Deliberately built on the shared outbox rather than as a bespoke sender: it
 * needs exactly the same claim, backoff, dead-letter and replay machinery, and
 * a second implementation would be a second place for those bugs to return.
 *
 * WHAT SYNCS: id, name, status, version. Nothing else. Contact details, notes
 * and the whole `rsg_*` CRM subsystem stay here — five copies of a client's
 * phone number is five places to leak it and five places to honour a deletion.
 */

export const REGISTRY_EVENT = "registry.client.changed";

type ClientRow = {
  id: string;
  name: string;
  status: string;
  registry_version: number;
};

function eventPayload(c: ClientRow, deleted = false) {
  return {
    client_id: c.id,
    version: Number(c.registry_version),
    name: c.name,
    status: c.status,
    deleted,
  };
}

/**
 * Queue one client's current state to every registry endpoint.
 *
 * The event id is `registry.client:<id>:<version>`, which makes the whole thing
 * idempotent end to end: the outbox's unique (endpoint_id, event_id) index stops
 * the same version being queued twice, and the receiver applies it only if the
 * version is newer than what it holds. Calling this redundantly is free — which
 * is what makes the reconcile sweep below a two-liner.
 */
export async function emitClientChange(clientId: string): Promise<{ queued: number }> {
  const sb = requireSupabase();
  const { data: client } = await sb
    .from("clients")
    .select("id, name, status, registry_version")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) return { queued: 0 };

  const c = client as ClientRow;
  return enqueue({
    eventType: REGISTRY_EVENT,
    eventId: `registry.client:${c.id}:${c.registry_version}`,
    payload: eventPayload(c),
    kind: "registry",
  });
}

/**
 * Drain deletion tombstones.
 *
 * A hard-deleted client is gone from `clients`, so without the tombstone table
 * the mirrors would keep serving it forever — deletion has to travel as an
 * event, not as an absence.
 *
 * `emitted_at` is stamped only after queueing succeeds. If this dies partway,
 * the next run re-queues, and the outbox's unique index makes that a no-op.
 */
export async function emitTombstones(limit = 100): Promise<{ queued: number }> {
  const sb = requireSupabase();
  const { data: rows } = await sb
    .from("client_registry_tombstones")
    .select("client_id, name, version")
    .is("emitted_at", null)
    .order("deleted_at", { ascending: true })
    .limit(limit);

  if (!rows?.length) return { queued: 0 };

  let queued = 0;
  for (const t of rows) {
    const result = await enqueue({
      eventType: REGISTRY_EVENT,
      eventId: `registry.client:${t.client_id}:${t.version}`,
      payload: {
        client_id: t.client_id,
        version: Number(t.version),
        name: t.name,
        status: "closed",
        deleted: true,
      },
      kind: "registry",
    });
    queued += result.queued;

    await sb
      .from("client_registry_tombstones")
      .update({ emitted_at: new Date().toISOString() })
      .eq("client_id", t.client_id);
  }

  return { queued };
}

/**
 * Nightly reconcile.
 *
 * Push handles latency; this handles the events that were dropped while an app
 * project was unreachable. Do NOT rely on push alone — a paused Supabase
 * project returns errors for days, and by the time it comes back every delivery
 * for it has dead-lettered. Nothing else would ever retry them.
 *
 * Two steps, both idempotent:
 *
 *   1. Replay registry dead letters. Cheap, and it recovers the common case
 *      (the project was down, the events are still on disk here).
 *
 *   2. Re-emit every client's CURRENT version. Rows already queued or delivered
 *      collide on the unique index and are skipped, so this only materialises
 *      what genuinely never got queued — the case where the website itself
 *      failed at enqueue time and no row was ever created. That gap is
 *      invisible to step 1, because there is no dead letter to find.
 */
export async function reconcileRegistry(options?: {
  replayLimit?: number;
  clientLimit?: number;
}): Promise<{ replayed: number; queued: number; scanned: number }> {
  const sb = requireSupabase();

  const { replayed } = await replayDeadLetters({
    eventType: REGISTRY_EVENT,
    limit: options?.replayLimit ?? 500,
  });

  const { data: clients } = await sb
    .from("clients")
    .select("id, name, status, registry_version")
    .order("updated_at", { ascending: false })
    .limit(options?.clientLimit ?? 1000);

  let queued = 0;
  for (const row of (clients ?? []) as ClientRow[]) {
    const result = await enqueue({
      eventType: REGISTRY_EVENT,
      eventId: `registry.client:${row.id}:${row.registry_version}`,
      payload: eventPayload(row),
      kind: "registry",
    });
    queued += result.queued;
  }

  const tombstones = await emitTombstones();

  return {
    replayed,
    queued: queued + tombstones.queued,
    scanned: clients?.length ?? 0,
  };
}

/**
 * Register an app project as a sync destination.
 *
 * Run once per app after creating its Supabase project. The secret must match
 * that project's REGISTRY_SYNC_SECRET, and must be DISTINCT per app — one
 * shared secret across five projects means one leak compromises all five.
 */
export async function registerAppDestination(input: {
  app: string;
  projectRef: string;
  secret: string;
}): Promise<{ id: string } | null> {
  const sb = requireSupabase();
  const url = `https://${input.projectRef}.supabase.co/functions/v1/registry-sync`;

  const { data, error } = await sb
    .from("webhook_endpoints")
    .upsert(
      {
        url,
        secret: input.secret,
        kind: "registry",
        description: `registry sync → ${input.app} (${input.projectRef})`,
        events: [REGISTRY_EVENT],
        enabled: true,
      },
      { onConflict: "url" }
    )
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[registry-sync] failed to register destination", {
      app: input.app,
      error: error.message,
    });
    return null;
  }
  return data ? { id: data.id as string } : null;
}
