import { NextResponse } from "next/server";
import { isAdminContext, requireAdmin } from "@/lib/admin-auth";
import { attachJourneys, getLeads } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  const leads = await attachJourneys(await getLeads());
  return NextResponse.json({ leads });
}
