import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getClients } from "@/lib/store";
import { toPublic } from "@/lib/seed";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const clients = await getClients();
  return NextResponse.json({ clients: clients.map(toPublic) });
}
