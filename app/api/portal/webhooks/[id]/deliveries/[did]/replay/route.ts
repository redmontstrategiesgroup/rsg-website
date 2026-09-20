import { NextResponse } from "next/server";
import { portalKeyGuard } from "@/lib/apiv1/route-guards";
import { portalWebhookCtx, handleReplay } from "@/lib/webhooks/cookie-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, context: { params: Promise<{ id: string; did: string }> }) {
  const ctx = await portalKeyGuard();
  if (ctx instanceof NextResponse) return ctx;
  const { id, did } = await context.params;
  return handleReplay(portalWebhookCtx(ctx), id, did);
}
