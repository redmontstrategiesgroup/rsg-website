/** Public proposal decline endpoint. */

import { NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import {
  getProposalByToken,
  recordProposalDecline,
} from "@/lib/managed-services/proposals";
import { sendAdminEmail } from "@/lib/managed-services/emails";

export const runtime = "nodejs";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Ctx = { params: Promise<{ token: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const ip = clientIp(request);
  if (!(await rateLimit(`proposal-decline:${ip}`, 10, 10 * 60 * 1000))) {
    return rateLimitResponse();
  }

  const { token } = await ctx.params;
  const proposal = await getProposalByToken(token);
  if (!proposal || proposal.status === "draft") {
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  }
  if (proposal.status === "accepted" || proposal.status === "declined") {
    return NextResponse.json(
      { error: "This proposal is no longer open." },
      { status: 409 }
    );
  }

  await recordProposalDecline(proposal);

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px;">
      <h2 style="margin: 0 0 12px;">Proposal declined</h2>
      <p style="margin: 0 0 8px; color: #333;">
        <strong>${esc(proposal.title)}</strong>
        ${proposal.preparedFor ? ` — prepared for ${esc(proposal.preparedFor)}` : ""}
      </p>
      <p style="margin: 0; color: #666;">Declined from the public proposal page.</p>
    </div>`;
  const text = [
    "Proposal declined",
    `Title: ${proposal.title}`,
    proposal.preparedFor ? `Prepared for: ${proposal.preparedFor}` : "",
    "Declined from the public proposal page.",
  ]
    .filter(Boolean)
    .join("\n");
  await sendAdminEmail(`Proposal declined: ${proposal.title}`, html, text);

  return NextResponse.json({ ok: true });
}
