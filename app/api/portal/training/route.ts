import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requirePortalContext } from "@/lib/lifecycle/access";
import { getTrainingItem, markTrainingComplete } from "@/lib/lifecycle/training";
import { logClientActivity } from "@/lib/lifecycle/activity";

export const runtime = "nodejs";

const schema = z.object({
  action: z.literal("complete"),
  trainingItemId: z.string().uuid(),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available." }, { status: 503 });
  }
  const ctx = await requirePortalContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await rateLimit(`portal-training:${ctx.client.id}:${clientIp(request)}`, 60, 10 * 60_000))) {
    return rateLimitResponse();
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const item = await getTrainingItem(body.trainingItemId);
  if (!item || !item.published) {
    return NextResponse.json({ error: "Training not found." }, { status: 404 });
  }

  await markTrainingComplete({
    trainingItemId: item.id,
    clientId: ctx.client.id,
    clientUserId: ctx.user.isLegacyOwner ? null : ctx.user.id,
  });
  await logClientActivity({
    clientId: ctx.client.id,
    actorType: "client",
    actorName: ctx.user.name,
    action: `Completed training "${item.title}"`,
    entityType: "training",
    entityId: item.id,
    visibleToClient: false,
  });
  return NextResponse.json({ ok: true });
}
