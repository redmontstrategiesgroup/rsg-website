import { NextResponse } from "next/server";
import { requirePortalContext, canManageTeam } from "@/lib/lifecycle/access";
import { requireSupabase } from "@/lib/lifecycle/core";
import { logClientActivity } from "@/lib/lifecycle/activity";
import { isSupabaseConfigured } from "@/lib/supabase";
import { apiPlatformEnabled } from "@/lib/env";
import { revokeApiKey } from "@/lib/apiv1/key-store";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  if (!apiPlatformEnabled() || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available." }, { status: 503 });
  }
  const ctx = await requirePortalContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!canManageTeam(ctx.user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { id } = await context.params;
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
