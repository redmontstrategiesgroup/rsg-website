import { NextResponse } from "next/server";
import { adminKeyGuard } from "@/lib/apiv1/route-guards";
import { adminWebhookCtx, handleTest } from "@/lib/webhooks/cookie-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await adminKeyGuard();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await context.params;
  return handleTest(adminWebhookCtx(ctx), id);
}
