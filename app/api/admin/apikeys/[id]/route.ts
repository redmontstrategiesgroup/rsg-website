import { NextResponse } from "next/server";
import { rateLimitAdminMutator } from "@/lib/admin-auth";
import { requireSupabase } from "@/lib/lifecycle/core";
import { revokeApiKey, revokeAnyAdminKey } from "@/lib/apiv1/key-store";
import { can } from "@/lib/scheduling/permissions";
import { writeAuditEvent } from "@/lib/audit";
import { adminKeyGuard } from "@/lib/apiv1/route-guards";
import { UUID_RE } from "@/lib/apiv1/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await adminKeyGuard();
  if (ctx instanceof NextResponse) return ctx;
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Key not found." }, { status: 404 });
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
