import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { BriefPayloadSchema, payloadError } from "@/lib/briefs/schema";
import { ingestBrief } from "@/lib/briefs/ingest";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if (!isAdminContext(ctx)) return ctx;
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  let json: unknown;
  try { json = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = BriefPayloadSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Check the highlighted fields.", details: payloadError(parsed.error) }, { status: 422 });
  try {
    const result = await ingestBrief(parsed.data, `manual:${randomUUID()}`, "manual");
    await writeAuditEvent({
      actorType: "admin",
      actorId: ctx.admin.id,
      actorEmail: ctx.admin.email,
      action: "brief.manual_ingest",
      entityType: "brief",
      entityId: result.briefId,
    });
    return NextResponse.json({ ok: true, briefId: result.briefId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The brief could not be saved. Check dashboard storage and try again." }, { status: 500 });
  }
}
