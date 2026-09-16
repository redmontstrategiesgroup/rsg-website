import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalContext, canManageTeam, type PortalContext } from "@/lib/lifecycle/access";
import { requireSupabase } from "@/lib/lifecycle/core";
import { logClientActivity } from "@/lib/lifecycle/activity";
import { isSupabaseConfigured } from "@/lib/supabase";
import { apiPlatformEnabled } from "@/lib/env";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { createApiKey, listApiKeys } from "@/lib/apiv1/key-store";
import { CLIENT_SCOPES, isClientScope } from "@/lib/apiv1/scopes";
import { ApiError } from "@/lib/apiv1/errors";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z
    .array(z.string())
    .min(1)
    .max(CLIENT_SCOPES.length)
    .refine((s) => s.every(isClientScope), "Unknown scope."),
});

async function guard(): Promise<PortalContext | NextResponse> {
  if (!apiPlatformEnabled() || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available." }, { status: 503 });
  }
  const ctx = await requirePortalContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!canManageTeam(ctx.user.role)) {
    return NextResponse.json(
      { error: "Only account owners and admins can manage API keys." },
      { status: 403 },
    );
  }
  return ctx;
}

export async function GET() {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;
  const keys = await listApiKeys(requireSupabase(), { type: "client", id: ctx.client.id });
  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;
  if (!(await rateLimit(`portal-apikeys:${ctx.client.id}:${clientIp(request)}`, 20, 10 * 60_000))) {
    return rateLimitResponse();
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const { key, plaintext } = await createApiKey(requireSupabase(), {
      owner: { type: "client", id: ctx.client.id },
      name: parsed.data.name,
      scopes: parsed.data.scopes,
      createdBy: ctx.user.email,
    });
    await writeAuditEvent({
      actorType: "system",
      actorEmail: ctx.user.email,
      action: "apikey.create",
      entityType: "api_key",
      entityId: key.id,
      metadata: { client_id: ctx.client.id },
    });
    await logClientActivity({
      clientId: ctx.client.id,
      actorType: "client",
      actorName: ctx.user.name,
      action: `Created API key "${key.name}"`,
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
