import { NextResponse } from "next/server";
import { isAdminContext, requireAdmin } from "@/lib/admin-auth";
import { briefListing } from "@/lib/call-proposal";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid lead id." }, { status: 400 });
  try {
    return NextResponse.json(await briefListing(id));
  } catch (err) {
    console.error("[call-proposal] listing failed", id, err);
    return NextResponse.json({ error: "Could not load call briefs." }, { status: 500 });
  }
}
