/**
 * Unified audit log for admin actions, auth events, and compliance exports.
 */

import { getSupabase } from "@/lib/supabase";

export type AuditActorType = "admin" | "system" | "cron" | "anonymous";

export type AuditEventInput = {
  actorType: AuditActorType;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
};

export async function writeAuditEvent(event: AuditEventInput): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    console.info(
      "[audit]",
      event.action,
      event.entityType ?? "",
      event.actorEmail ?? event.actorId ?? ""
    );
    return;
  }
  try {
    const { error } = await sb.from("audit_events").insert({
      actor_type: event.actorType,
      actor_id: event.actorId ?? null,
      actor_email: event.actorEmail ?? null,
      action: event.action.slice(0, 120),
      entity_type: event.entityType?.slice(0, 80) ?? null,
      entity_id: event.entityId ?? null,
      metadata: event.metadata ?? {},
      ip: event.ip?.slice(0, 64) ?? null,
      user_agent: event.userAgent?.slice(0, 400) ?? null,
    });
    if (error) throw error;
  } catch (err) {
    // A dropped audit write is a compliance gap, not a cosmetic warning: with
    // the audit_events table missing/unmigrated, EVERY admin action would land
    // here and the trail would be silently empty. Log at error level (Sentry
    // captures console.error) with the action, so "no audit rows" is
    // distinguishable from "nobody did anything". Still non-throwing — the
    // audit sink must never break the user-facing action it records.
    console.error(
      `[audit] WRITE FAILED for action="${event.action}" actor="${
        event.actorEmail ?? event.actorId ?? "?"
      }" — the audit trail is not being persisted. Is audit_events migrated?`,
      err
    );
  }
}

export async function listAuditEvents(params: {
  limit?: number;
  offset?: number;
  action?: string;
  /** Prefix match, e.g. "security." — mutually exclusive with `action`. */
  actionPrefix?: string;
  actorEmail?: string;
  actorType?: AuditActorType;
  entityType?: string;
  entityId?: string;
  since?: string;
  until?: string;
}): Promise<unknown[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let q = sb
    .from("audit_events")
    .select("*")
    .order("created_at", { ascending: false })
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 100) - 1);
  if (params.action) q = q.eq("action", params.action);
  else if (params.actionPrefix) q = q.like("action", `${params.actionPrefix}%`);
  if (params.actorEmail) q = q.eq("actor_email", params.actorEmail);
  if (params.actorType) q = q.eq("actor_type", params.actorType);
  if (params.entityType) q = q.eq("entity_type", params.entityType);
  if (params.entityId) q = q.eq("entity_id", params.entityId);
  if (params.since) q = q.gte("created_at", params.since);
  if (params.until) q = q.lte("created_at", params.until);
  try {
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    // Degrade gracefully (e.g. audit table not yet migrated) rather than 500 —
    // the audit log is a Supabase-backed feature; when unavailable it is empty.
    console.warn("[audit] list failed — returning empty.", err);
    return [];
  }
}

/** Count events matching any of `actions` since a timestamp. Returns null
 *  when the audit store is unavailable (so callers can say "unavailable"
 *  instead of showing a fake zero). */
export async function countAuditEvents(params: {
  actions: string[];
  since: string;
}): Promise<number | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { count, error } = await sb
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .in("action", params.actions)
      .gte("created_at", params.since);
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    console.warn("[audit] count failed", err);
    return null;
  }
}
