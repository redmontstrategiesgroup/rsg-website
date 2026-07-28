import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import {
  listPrivateAiOpportunities,
  updatePrivateAiOpportunity,
} from "@/lib/private-ai/opportunities";
import { PRIVATE_AI_PIPELINE_STAGES } from "@/lib/private-ai/types";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  const opportunities = await listPrivateAiOpportunities();
  return NextResponse.json({ opportunities });
}

const PatchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(PRIVATE_AI_PIPELINE_STAGES).optional(),
  owner: z.string().max(160).optional(),
  adminNotes: z.string().max(8000).optional(),
  technicalNotes: z.string().max(8000).optional(),
  securityNotes: z.string().max(8000).optional(),
  budgetRange: z.string().max(120).optional(),
  timeline: z.string().max(120).optional(),
});

export async function PATCH(request: Request) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid patch." }, { status: 400 });
  }

  const { id, ...patch } = parsed.data;
  const updated = await updatePrivateAiOpportunity(id, patch, ctx.admin.email);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ opportunity: updated });
}
