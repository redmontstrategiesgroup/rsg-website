/**
 * Client Lifecycle Platform — client activity log.
 *
 * A lightweight audit/activity feed shared by the portal ("what happened on
 * my account") and the admin console ("what happened across all clients").
 * Writes are fire-and-forget: an activity-log failure must never break the
 * business action that triggered it.
 */

import { requireSupabase } from "@/lib/lifecycle/core";
import type { ClientActivity } from "@/lib/lifecycle/types";

export type LogClientActivityInput = {
  clientId?: string;
  projectId?: string;
  actorType: ClientActivity["actor_type"];
  actorName?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  /** Defaults to true; set false for internal-only entries. */
  visibleToClient?: boolean;
  metadata?: Record<string, unknown>;
};

/**
 * Fire-and-forget activity insert. Catches and logs every failure (including
 * Supabase being unconfigured) — this function never throws.
 */
export async function logClientActivity(input: LogClientActivityInput): Promise<void> {
  try {
    const sb = requireSupabase();
    const { error } = await sb.from("client_activity").insert({
      client_id: input.clientId ?? null,
      project_id: input.projectId ?? null,
      actor_type: input.actorType,
      actor_name: input.actorName ?? "",
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      visible_to_client: input.visibleToClient ?? true,
      metadata: input.metadata ?? {},
    });
    if (error) {
      console.error(`[lifecycle] logClientActivity "${input.action}" failed`, error);
    }
  } catch (err) {
    console.error(`[lifecycle] logClientActivity "${input.action}" failed`, err);
  }
}

/** Activity feed for one client, newest first. */
export async function listClientActivity(
  clientId: string,
  opts: { visibleOnly?: boolean; limit?: number } = {}
): Promise<ClientActivity[]> {
  const sb = requireSupabase();
  let query = sb
    .from("client_activity")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.visibleOnly) query = query.eq("visible_to_client", true);
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list activity for client ${clientId}: ${error.message}`);
  }
  return (data ?? []) as ClientActivity[];
}

/** Cross-client activity feed for the admin console, newest first. */
export async function listRecentActivity(limit = 50): Promise<ClientActivity[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("client_activity")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`Failed to list recent activity: ${error.message}`);
  }
  return (data ?? []) as ClientActivity[];
}
