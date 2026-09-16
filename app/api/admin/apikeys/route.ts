import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminContext, requireAdmin, rateLimitAdminMutator, type AdminContext } from "@/lib/admin-auth";
import { requireSupabase } from "@/lib/lifecycle/core";
import { isSupabaseConfigured } from "@/lib/supabase";
import { apiPlatformEnabled } from "@/lib/env";
import { createApiKey, listApiKeys, listAllAdminKeys } from "@/lib/apiv1/key-store";
import { capAdminScopes, scopesAllowedFor } from "@/lib/apiv1/scopes";
import { ApiError } from "@/lib/apiv1/errors";
import { can } from "@/lib/scheduling/permissions";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.string()).min(1).max(20),
});

async function guard(): Promise<AdminContext | NextResponse> {
  if (!apiPlatformEnabled() || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available." }, { status: 503 });
  }
  const ctx = await requireAdmin();
  if (!isAdminContext(ctx)) return ctx;
  return ctx;
}

export async function GET() {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;
  const sb = requireSupabase();
  const keys = can("manage_team", ctx.role)
    ? await listAllAdminKeys(sb)
    : await listApiKeys(sb, { type: "admin", id: ctx.admin.id });
  return NextResponse.json({ keys, allowed_scopes: scopesAllowedFor(ctx.role) });
}

export async function POST(request: Request) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 422 });
  }
  const { allowed, rejected } = capAdminScopes(parsed.data.scopes, ctx.role);
  if (rejected.length > 0) {
    return NextResponse.json(
      { error: "Some scopes exceed your permissions.", details: { scopes: rejected } },
      { status: 422 },
    );
  }
  try {
    const { key, plaintext } = await createApiKey(requireSupabase(), {
      owner: { type: "admin", id: ctx.admin.id },
      name: parsed.data.name,
      scopes: allowed,
      createdBy: ctx.admin.email,
    });
    await writeAuditEvent({
      actorType: "admin",
      actorId: ctx.admin.id,
      actorEmail: ctx.admin.email,
      action: "apikey.create",
      entityType: "api_key",
      entityId: key.id,
    });
    return NextResponse.json({ key, plaintext }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    }
    throw err;
  }
}
