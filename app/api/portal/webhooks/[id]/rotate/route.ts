import { NextResponse } from "next/server";
import { portalKeyGuard } from "@/lib/apiv1/route-guards";
import { portalWebhookCtx, handleRotate } from "@/lib/webhooks/cookie-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await portalKeyGuard();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await context.params;
  return handleRotate(portalWebhookCtx(ctx), id);
}
