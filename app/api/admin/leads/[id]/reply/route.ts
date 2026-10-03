import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { writeAuditEvent } from "@/lib/audit";
import { clientIp } from "@/lib/security";
import { sendReply } from "@/lib/lead-ai";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  insightId: z.string().regex(UUID_RE, "Invalid draft id."),
  subject: z.string().max(400),
  body: z.string().max(10_000),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid lead id." }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const result = await sendReply({ leadId: id, adminId: ctx.admin.id, ...parsed.data });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await writeAuditEvent({
    actorType: "admin",
    actorId: ctx.admin.id,
    actorEmail: ctx.admin.email,
    action: "lead.reply_sent",
    entityType: "lead",
    entityId: id,
    metadata: { insightId: parsed.data.insightId },
    ip: clientIp(request),
  });

  return NextResponse.json({ insight: result.insight });
}
