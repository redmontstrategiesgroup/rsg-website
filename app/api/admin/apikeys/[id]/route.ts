import { NextResponse } from "next/server";
import { isAdminContext, requireAdmin, rateLimitAdminMutator } from "@/lib/admin-auth";
import { requireSupabase } from "@/lib/lifecycle/core";
import { isSupabaseConfigured } from "@/lib/supabase";
import { apiPlatformEnabled } from "@/lib/env";
import { revokeApiKey, revokeAnyAdminKey } from "@/lib/apiv1/key-store";
import { can } from "@/lib/scheduling/permissions";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!apiPlatformEnabled() || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available." }, { status: 503 });
  }
  const ctx = await requireAdmin();
  if (!isAdminContext(ctx)) return ctx;
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;
  const { id } = await context.params;
  const sb = requireSupabase();
  const ok = can("manage_team", ctx.role)
    ? await revokeAnyAdminKey(sb, id)
    : await revokeApiKey(sb, { type: "admin", id: ctx.admin.id }, id);
  if (!ok) return NextResponse.json({ error: "Key not found." }, { status: 404 });
  await writeAuditEvent({
    actorType: "admin",
    actorId: ctx.admin.id,
    actorEmail: ctx.admin.email,
    action: "apikey.revoke",
    entityType: "api_key",
    entityId: id,
  });
  return NextResponse.json({ ok: true });
}
