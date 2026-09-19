import { NextResponse } from "next/server";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit";
import { ENTITY_PATCH as updates } from "@/lib/dashboard/entity-schemas";

export async function PATCH(request: Request, context: { params: Promise<{ entity: string; id: string }> }) {
  // Elevated permission required: see POST handler note on dashboard writes.
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  const { entity, id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid record." }, { status: 400 });
  const config = updates[entity as keyof typeof updates];
  if (!config) return NextResponse.json({ error: "Unsupported record type." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = config.schema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Invalid update." }, { status: 422 });
  const db = getSupabase();
  if (!db) return NextResponse.json({ error: "Dashboard storage is not configured." }, { status: 503 });
  const { data, error } = await db.from(config.table).update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: "The record could not be updated." }, { status: 500 });
  await db.from("audit_log").insert({ actor_identifier: ctx.admin.email, action: "update", entity_type: entity, entity_id: id, details: { fields: Object.keys(parsed.data) } });
  await writeAuditEvent({
    actorType: "admin",
    actorId: ctx.admin.id,
    actorEmail: ctx.admin.email,
    action: "dashboard.update",
    entityType: entity,
    entityId: id,
    metadata: { fields: Object.keys(parsed.data) },
  });
  return NextResponse.json({ record: data });
}
