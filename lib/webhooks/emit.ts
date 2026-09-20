import { UUID_RE } from "@/lib/apiv1/pagination";
import { getSupabase } from "@/lib/supabase";
import { enqueue } from "@/lib/webhooks/outbox";
import { visibleTo, type EventType } from "./events";

/**
 * Owner-scoped webhook emission.
 *
 * Call sites live INSIDE the lib functions (createTicket, approveMilestone,
 * saveLead, …) so the portal UI, the admin console and the API all emit the
 * same events. Emission never throws and never waits for delivery: it resolves
 * the eligible endpoints, hands them to the outbox, and returns.
 *
 * Eligibility: `kind = 'client'`, enabled, not auto-disabled, and either an
 * admin-owned endpoint (sees everything) or a client-owned endpoint for the
 * event's client. Subscription and audience are checked here in JS because
 * `events` is a jsonb array and an owner has at most ten endpoints.
 */

type EndpointPick = {
  id: string;
  owner_type: "client" | "admin" | null;
  owner_id: string | null;
  events: unknown;
};

export type EmitOptions = {
  /** The domain entity this event is about — with `version` it forms the stable event_id. */
  entityId: string;
  /** `updated_at`, a counter, or anything that changes when the entity does. */
  version: string | number;
  /** The client this event belongs to; omit for admin-only events. */
  clientId?: string | null;
};

export async function emitEvent(
  type: EventType,
  data: Record<string, unknown>,
  opts: EmitOptions,
): Promise<{ queued: number }> {
  try {
    const sb = getSupabase();
    if (!sb) return { queued: 0 };

    let query = sb
      .from("webhook_endpoints")
      .select("id, owner_type, owner_id, events")
      .eq("kind", "client")
      .eq("enabled", true)
      .is("disabled_at", null);
    // clientId always comes from one of our own rows, but it is interpolated
    // into a PostgREST filter, so refuse anything that is not a UUID.
    const clientId = opts.clientId && UUID_RE.test(opts.clientId) ? opts.clientId : null;
    query = clientId
      ? query.or(`owner_type.eq.admin,and(owner_type.eq.client,owner_id.eq.${clientId})`)
      : query.eq("owner_type", "admin");

    const { data: rows, error } = await query;
    if (error) {
      console.error("[webhooks] emit lookup failed", { type, error: error.message });
      return { queued: 0 };
    }

    const endpointIds = ((rows ?? []) as EndpointPick[])
      .filter((ep) => ep.owner_type === "client" || ep.owner_type === "admin")
      .filter((ep) => visibleTo(type, ep.owner_type as "client" | "admin"))
      .filter((ep) => Array.isArray(ep.events) && (ep.events as string[]).includes(type))
      .map((ep) => ep.id);
    if (endpointIds.length === 0) return { queued: 0 };

    const payload = { ...data, ...(clientId ? { client_id: clientId } : {}) };
    return await enqueue({
      eventType: type,
      eventId: `${type}:${opts.entityId}:${opts.version}`,
      payload,
      kind: "client",
      endpointIds,
      skipSubscriptionFilter: true,
    });
  } catch (err) {
    console.error("[webhooks] emit threw", { type, error: err instanceof Error ? err.message : String(err) });
    return { queued: 0 };
  }
}

/** Send a `ping` to exactly one endpoint, regardless of its subscriptions. */
export async function sendTestEvent(endpointId: string): Promise<{ queued: number }> {
  const sentAt = new Date().toISOString();
  return enqueue({
    eventType: "ping",
    eventId: `ping:${endpointId}:${Date.now()}`,
    payload: { endpoint_id: endpointId, sent_at: sentAt },
    kind: "client",
    endpointIds: [endpointId],
    skipSubscriptionFilter: true,
  });
}
