import { NextResponse } from "next/server";
import { getAdminSession, renewAdminSession } from "@/lib/auth";

export const runtime = "nodejs";

/** Session keepalive for the admin console (sliding expiration). */
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await renewAdminSession();
  return NextResponse.json({ ok: true, email: admin.email });
}
