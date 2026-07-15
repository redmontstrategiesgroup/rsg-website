import { NextResponse } from "next/server";
import { clearAdminSessionCookie, getAdminSession } from "@/lib/auth";
import { revokeAdminSession } from "@/lib/store";
import { writeAuditEvent } from "@/lib/audit";
import { clientIp } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (session?.sid) await revokeAdminSession(session.sid);
  if (session) {
    await writeAuditEvent({
      actorType: "admin",
      actorId: session.sub,
      actorEmail: session.email,
      action: "admin.logout",
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
  }
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
