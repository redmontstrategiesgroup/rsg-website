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
    console.warn("[audit] write failed", err);
  }
}

export async function listAuditEvents(params: {
  limit?: number;
  offset?: number;
  action?: string;
  actorEmail?: string;
}): Promise<unknown[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let q = sb
    .from("audit_events")
    .select("*")
    .order("created_at", { ascending: false })
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 100) - 1);
  if (params.action) q = q.eq("action", params.action);
  if (params.actorEmail) q = q.eq("actor_email", params.actorEmail);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
