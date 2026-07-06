import { NextResponse } from "next/server";
import { getSession, renewSession } from "@/lib/auth";
import { getClientById } from "@/lib/store";
import { toPublic } from "@/lib/seed";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ client: null }, { status: 401 });
  }
  const client = await getClientById(session.sub);
  if (!client) {
    return NextResponse.json({ client: null }, { status: 401 });
  }
  // Sliding expiration: keep active portal users signed in.
  await renewSession();
  return NextResponse.json({ client: toPublic(client) });
}
