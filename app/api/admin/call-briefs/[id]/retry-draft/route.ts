import { NextResponse } from "next/server";
import { isAdminContext, rateLimitAdminMutator, requireAdmin } from "@/lib/admin-auth";
import { writeAuditEvent } from "@/lib/audit";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { briefListing, callProposalEnabled, getBrief, retryProposalDraft } from "@/lib/call-proposal";
import { runResultStatus } from "@/lib/call-proposal/pipeline";

export const runtime = "nodejs";
// One model call (120 s timeout) plus a handful of writes.
export const maxDuration = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;
  if (!(await rateLimit(`call-proposal:${ctx.admin.id}`, 10, 10 * 60_000))) {
    return rateLimitResponse();
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid brief id." }, { status: 400 });
  if (!callProposalEnabled()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY isn't configured: add it to the environment first." },
      { status: 503 },
    );
  }

  let before;
  try {
    before = await getBrief(id);
  } catch (err) {
    console.error("[call-proposal] getBrief failed", id, err);
    return NextResponse.json({ error: "Drafting failed unexpectedly. Try again in a minute." }, { status: 500 });
  }
  if (!before) return NextResponse.json({ error: "Brief not found." }, { status: 404 });

  let result;
  try {
    result = await retryProposalDraft(id);
  } catch (err) {
    console.error("[call-proposal] retryProposalDraft failed", id, err);
    return NextResponse.json({ error: "Drafting failed unexpectedly. Try again in a minute." }, { status: 500 });
  }

  await writeAuditEvent({
    actorType: "admin",
    actorId: ctx.admin.id,
    actorEmail: ctx.admin.email,
    action: "lead.call_proposal_retry",
    entityType: "lead",
    entityId: before.leadId,
    metadata: result.ok
      ? { ok: true, briefId: id, proposalId: result.proposalId }
      : { ok: false, reason: result.reason, briefId: id },
    ip: clientIp(request),
  });

  const { status, error } = runResultStatus(result);
  try {
    const listing = await briefListing(before.leadId);
    return NextResponse.json(
      { ...listing, ok: result.ok, error, briefId: id, proposalId: result.ok ? result.proposalId : null },
      { status },
    );
  } catch {
    return NextResponse.json(
      {
        ok: result.ok,
        error: error ?? "Draft created, but the panel couldn't refresh.",
        briefId: id,
        proposalId: result.ok ? result.proposalId : null,
      },
      { status },
    );
  }
}
