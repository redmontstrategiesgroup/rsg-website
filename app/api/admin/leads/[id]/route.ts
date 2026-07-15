import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { updateLead } from "@/lib/store";
import { writeAuditEvent } from "@/lib/audit";
import { clientIp } from "@/lib/security";

export const runtime = "nodejs";

const PatchSchema = z.object({
  status: z
    .enum([
      "new",
      "contacted",
      "qualified",
      "meeting_scheduled",
      "won",
      "lost",
      "spam",
      "archived",
    ])
    .optional(),
  notes: z.string().max(8000).optional(),
  owner: z.string().max(200).optional(),
  archivedAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;

  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  const { id } = await context.params;
  if (!id || id.length > 80) {
    return NextResponse.json({ error: "Invalid lead id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid patch." },
      { status: 400 }
    );
  }

  const lead = await updateLead(id, parsed.data);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  await writeAuditEvent({
    actorType: "admin",
    actorId: ctx.admin.id,
    actorEmail: ctx.admin.email,
    action: "lead.update",
    entityType: "lead",
    entityId: id,
    metadata: parsed.data,
    ip: clientIp(request),
  });

  return NextResponse.json({ lead });
}
