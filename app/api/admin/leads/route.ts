import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getLeads } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const leads = await getLeads();
  return NextResponse.json({ leads });
}
