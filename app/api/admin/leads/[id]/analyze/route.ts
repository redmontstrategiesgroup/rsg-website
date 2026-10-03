import { NextResponse } from "next/server";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { writeAuditEvent } from "@/lib/audit";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { getInsightSummary } from "@/lib/lead-ai/db";
import { leadAiEnabled, runLeadAnalysis } from "@/lib/lead-ai";

export const runtime = "nodejs";
// One model call (30 s timeout, 1 retry) plus two small writes.
export const maxDuration = 75;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ id: string }> };

async function summary(id: string) {
  const { latest, lastSent } = await getInsightSummary(id);
  return { latest, lastSent, enabled: leadAiEnabled() };
}

export async function GET(_request: Request, context: Ctx) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid lead id." }, { status: 400 });
  }
  try {
    return NextResponse.json(await summary(id));
  } catch {
    return NextResponse.json({ error: "Could not load the AI analysis." }, { status: 500 });
  }
}

export async function POST(request: Request, context: Ctx) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;
  // Each run is a paid model call: tighter than the generic mutator limit.
  if (!(await rateLimit(`lead-ai:${ctx.admin.id}`, 20, 10 * 60_000))) {
    return rateLimitResponse();
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid lead id." }, { status: 400 });
  }
  if (!leadAiEnabled()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY isn't configured: add it to the environment first." },
      { status: 503 },
    );
  }

  const result = await runLeadAnalysis(id);
  await writeAuditEvent({
    actorType: "admin",
    actorId: ctx.admin.id,
    actorEmail: ctx.admin.email,
    action: "lead.ai_analyze",
    entityType: "lead",
    entityId: id,
    metadata: result.ok
      ? { ok: true, insightId: result.insightId }
      : { ok: false, reason: result.reason, insightId: result.insightId ?? null },
    ip: clientIp(request),
  });

  if (!result.ok && result.reason === "not_found") {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  if (!result.ok && result.reason === "skipped") {
    return NextResponse.json(
      { error: "This lead is marked spam or archived: change its status to analyze it." },
      { status: 409 },
    );
  }

  try {
    const body = await summary(id);
    return NextResponse.json(
      { ...body, ok: result.ok, error: result.ok ? null : (result.error ?? "Analysis failed.") },
      { status: result.ok ? 200 : 502 },
    );
  } catch {
    return NextResponse.json({ error: "Could not load the AI analysis." }, { status: 500 });
  }
}
