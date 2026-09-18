import { NextResponse } from "next/server";
import { requireSupabase } from "@/lib/lifecycle/core";
import { logClientActivity } from "@/lib/lifecycle/activity";
import { revokeApiKey } from "@/lib/apiv1/key-store";
import { writeAuditEvent } from "@/lib/audit";
import { portalKeyGuard } from "@/lib/apiv1/route-guards";
import { UUID_RE } from "@/lib/apiv1/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await portalKeyGuard();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Key not found." }, { status: 404 });
  const ok = await revokeApiKey(requireSupabase(), { type: "client", id: ctx.client.id }, id);
  if (!ok) return NextResponse.json({ error: "Key not found." }, { status: 404 });
  await writeAuditEvent({
    actorType: "system",
    actorEmail: ctx.user.email,
    action: "apikey.revoke",
    entityType: "api_key",
    entityId: id,
    metadata: { client_id: ctx.client.id },
  });
  await logClientActivity({
    clientId: ctx.client.id,
    actorType: "client",
    actorName: ctx.user.name,
    action: "Revoked an API key",
    entityType: "api_key",
    entityId: id,
  });
  return NextResponse.json({ ok: true });
}
