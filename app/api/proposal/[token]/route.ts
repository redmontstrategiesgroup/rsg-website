import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  addProposalComment,
  approveProposal,
  getProposalByToken,
  proposalTotals,
  recordProposalEvent,
  requestRevision,
  setOptionSelected,
} from "@/lib/lifecycle/proposals";
import { onProposalApproved } from "@/lib/lifecycle/orchestrate";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

function unavailable() {
  return NextResponse.json({ error: "Not available right now." }, { status: 503 });
}

export async function GET(request: Request, { params }: Params) {
  if (!isSupabaseConfigured()) return unavailable();
  if (!(await rateLimit(`proposal-get:${clientIp(request)}`, 60, 60_000))) {
    return rateLimitResponse();
  }
  const { token } = await params;
  const loaded = await getProposalByToken(token);
  if (!loaded || loaded.proposal.status === "draft") {
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  }
  await recordProposalEvent(loaded.proposal.id, "opened", {
    actor: "client",
    ip: clientIp(request),
  });
  const totals = proposalTotals(loaded.proposal, loaded.options);
  return NextResponse.json({
    proposal: loaded.proposal,
    options: loaded.options,
    comments: loaded.comments,
    totals,
  });
}

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("heartbeat"), seconds: z.number().int().min(1).max(300) }),
  z.object({ action: z.literal("section_view"), sectionKey: z.string().max(100) }),
  z.object({
    action: z.literal("option"),
    optionId: z.string().uuid(),
    selected: z.boolean(),
  }),
  z.object({
    action: z.literal("comment"),
    name: z.string().min(1).max(200),
    sectionKey: z.string().max(100).optional(),
    body: z.string().min(1).max(5000),
  }),
  z.object({ action: z.literal("approve"), name: z.string().min(2).max(200) }),
  z.object({
    action: z.literal("revision"),
    name: z.string().min(1).max(200),
    note: z.string().min(1).max(5000),
  }),
]);

export async function POST(request: Request, { params }: Params) {
  if (!isSupabaseConfigured()) return unavailable();
  if (!(await rateLimit(`proposal-post:${clientIp(request)}`, 60, 10 * 60_000))) {
    return rateLimitResponse();
  }
  const { token } = await params;
  const loaded = await getProposalByToken(token);
  if (!loaded || loaded.proposal.status === "draft") {
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  }
  const { proposal } = loaded;

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const interactive =
    proposal.status === "sent" ||
    proposal.status === "viewed" ||
    proposal.status === "revision_requested";

  switch (body.action) {
    case "heartbeat":
      await recordProposalEvent(proposal.id, "view_heartbeat", {
        viewSeconds: body.seconds,
      });
      return NextResponse.json({ ok: true });

    case "section_view":
      await recordProposalEvent(proposal.id, "section_viewed", {
        sectionKey: body.sectionKey,
      });
      return NextResponse.json({ ok: true });

    case "option": {
      if (!interactive) {
        return NextResponse.json(
          { error: "This proposal can no longer be changed." },
          { status: 409 },
        );
      }
      const result = await setOptionSelected(proposal.id, body.optionId, body.selected);
      return NextResponse.json({ ok: true, ...result });
    }

    case "comment": {
      const comment = await addProposalComment(proposal.id, {
        authorType: "client",
        authorName: body.name,
        sectionKey: body.sectionKey,
        body: body.body,
      });
      return NextResponse.json({ ok: true, comment });
    }

    case "revision": {
      if (!interactive) {
        return NextResponse.json(
          { error: "This proposal can no longer be changed." },
          { status: 409 },
        );
      }
      await requestRevision(proposal.id, { name: body.name, note: body.note });
      return NextResponse.json({ ok: true, status: "revision_requested" });
    }

    case "approve": {
      if (proposal.status !== "sent" && proposal.status !== "viewed") {
        return NextResponse.json(
          { error: `This proposal is ${proposal.status} and cannot be approved.` },
          { status: 409 },
        );
      }
      const approved = await approveProposal(proposal.id, {
        name: body.name,
        ip: clientIp(request),
      });
      try {
        await onProposalApproved(approved);
      } catch (error) {
        console.error("[proposal] approval orchestration failed", error);
      }
      return NextResponse.json({ ok: true, status: "approved" });
    }
  }
}
