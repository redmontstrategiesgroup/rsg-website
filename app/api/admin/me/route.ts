import { NextResponse } from "next/server";
import { renewAdminSession } from "@/lib/auth";
import { resolveAdminContext } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** Session keepalive for the admin console (sliding expiration). */
export async function GET() {
  const ctx = await resolveAdminContext();
  if (!ctx) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await renewAdminSession();
  return NextResponse.json({
    ok: true,
    email: ctx.admin.email,
    name: ctx.admin.name,
    role: ctx.role,
    mfaEnabled: ctx.admin.mfaEnabled,
  });
}
