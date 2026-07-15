import { NextResponse } from "next/server";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit";

const updates = {
  briefs: { table: "briefs", schema: z.object({ is_read: z.boolean().optional(), is_pinned: z.boolean().optional(), is_archived: z.boolean().optional(), status: z.enum(["draft","published","archived"]).optional() }).strict() },
  actions: { table: "action_items", schema: z.object({ status: z.enum(["new","reviewing","planned","in_progress","blocked","completed","dismissed"]).optional(), priority: z.enum(["critical","high","medium","low"]).optional(), due_date: z.iso.date().nullable().optional(), deferred_until: z.iso.date().nullable().optional(), dismissal_reason: z.string().max(2_000).nullable().optional(), requires_review: z.boolean().optional(), approved_at: z.iso.datetime().nullable().optional(), completed_at: z.iso.datetime().nullable().optional() }).strict() },
  opportunities: { table: "opportunities", schema: z.object({ stage: z.enum(["discovered","reviewing","validating","approved","building","launched","paused","rejected"]).optional(), requires_review: z.boolean().optional(), approved_at: z.iso.datetime().nullable().optional() }).strict() },
  risks: { table: "risks", schema: z.object({ status: z.enum(["active","monitoring","mitigated","accepted","closed"]).optional(), last_reviewed_at: z.iso.datetime().nullable().optional() }).strict() },
  ideas: { table: "ideas", schema: z.object({ status: z.enum(["captured","reviewing","validated","building","shipped","dismissed"]).optional() }).strict() },
  notifications: { table: "notifications", schema: z.object({ is_read: z.boolean() }).strict() },
} as const;

export async function PATCH(request: Request, context: { params: Promise<{ entity: string; id: string }> }) {
  const ctx = await requireAdmin();
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
