import { NextResponse } from "next/server";
import { isAdminContext, rateLimitAdminMutator, requireAdmin } from "@/lib/admin-auth";
import { writeAuditEvent } from "@/lib/audit";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { briefListing, callProposalEnabled, draftProposalForLead } from "@/lib/call-proposal";
import { runResultStatus } from "@/lib/call-proposal/pipeline";

export const runtime = "nodejs";
// Two model calls (120 s timeout each, no retries) plus a handful of writes.
export const maxDuration = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;
  // Each run is two paid model calls.
  if (!(await rateLimit(`call-proposal:${ctx.admin.id}`, 10, 10 * 60_000))) {
    return rateLimitResponse();
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid lead id." }, { status: 400 });
  if (!callProposalEnabled()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY isn't configured: add it to the environment first." },
      { status: 503 },
    );
  }

  let result;
  try {
    result = await draftProposalForLead(id, ctx.admin.name || ctx.admin.email);
  } catch (err) {
    console.error("[call-proposal] drafting failed", id, err);
    return NextResponse.json({ error: "Drafting failed unexpectedly. Try again in a minute." }, { status: 500 });
  }

  await writeAuditEvent({
    actorType: "admin",
    actorId: ctx.admin.id,
    actorEmail: ctx.admin.email,
    action: "lead.call_proposal",
    entityType: "lead",
    entityId: id,
    metadata: result.ok
      ? { ok: true, briefId: result.briefId, proposalId: result.proposalId }
      : { ok: false, reason: result.reason, briefId: "briefId" in result ? result.briefId : null },
    ip: clientIp(request),
  });

  const { status, error } = runResultStatus(result);
  if (status === 404) return NextResponse.json({ error: "Lead not found." }, { status });
  try {
    const listing = await briefListing(id);
    return NextResponse.json(
      {
        ...listing,
        ok: result.ok,
        error,
        briefId: "briefId" in result ? result.briefId : null,
        proposalId: result.ok ? result.proposalId : null,
      },
      { status },
    );
  } catch {
    return NextResponse.json({ error: error ?? "Could not load call briefs." }, { status: status === 200 ? 500 : status });
  }
}
