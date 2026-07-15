import { NextResponse } from "next/server";
import { getSession, clearSessionCookie } from "@/lib/auth";
import { revokeSession } from "@/lib/store";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  if (session?.sid) await revokeSession(session.sid);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
