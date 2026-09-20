import { NextResponse } from "next/server";
import { adminKeyGuard } from "@/lib/apiv1/route-guards";
import { adminWebhookCtx, handleReplay } from "@/lib/webhooks/cookie-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, context: { params: Promise<{ id: string; did: string }> }) {
  const ctx = await adminKeyGuard();
  if (ctx instanceof NextResponse) return ctx;
  const { id, did } = await context.params;
  return handleReplay(adminWebhookCtx(ctx), id, did);
}
