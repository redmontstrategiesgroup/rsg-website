import { NextResponse } from "next/server";
import { adminKeyGuard } from "@/lib/apiv1/route-guards";
import { adminWebhookCtx, handleDeliveries } from "@/lib/webhooks/cookie-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await adminKeyGuard();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await context.params;
  return handleDeliveries(adminWebhookCtx(ctx), request, id);
}
