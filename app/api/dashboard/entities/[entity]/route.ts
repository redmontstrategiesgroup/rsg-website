import { NextResponse } from "next/server";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";
import { writeAuditEvent } from "@/lib/audit";
import { ENTITY_CREATE as schemas } from "@/lib/dashboard/entity-schemas";

export async function POST(request: Request, context: { params: Promise<{ entity: string }> }) {
  // Dashboard writes (create/approve/dismiss records) require an elevated
  // permission, not just any authenticated admin, so viewer/consultant/
  // contractor roles can't mutate executive-intelligence records.
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  const { entity } = await context.params;
  const config = schemas[entity as keyof typeof schemas];
  if (!config) return NextResponse.json({ error: "Unsupported record type." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = config.schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid record.", details: parsed.error.flatten() }, { status: 422 });
  const db = getSupabase();
  if (!db) return NextResponse.json({ error: "Dashboard storage is not configured." }, { status: 503 });
  const { data, error } = await db.from(config.table).insert(parsed.data as never).select("*").single();
  if (error) return NextResponse.json({ error: "The record could not be created." }, { status: 500 });
  await db.from("audit_log").insert({ actor_identifier: ctx.admin.email, action: "create", entity_type: entity, entity_id: data.id });
  await writeAuditEvent({
    actorType: "admin",
    actorId: ctx.admin.id,
    actorEmail: ctx.admin.email,
    action: "dashboard.create",
    entityType: entity,
    entityId: data.id,
  });
  return NextResponse.json({ record: data }, { status: 201 });
}
