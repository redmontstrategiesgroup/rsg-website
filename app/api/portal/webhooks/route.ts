import { NextResponse } from "next/server";
import { portalKeyGuard } from "@/lib/apiv1/route-guards";
import { portalWebhookCtx, handleCreate, handleList } from "@/lib/webhooks/cookie-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await portalKeyGuard();
  if (ctx instanceof NextResponse) return ctx;
  return handleList(portalWebhookCtx(ctx));
}

export async function POST(request: Request) {
  const ctx = await portalKeyGuard();
  if (ctx instanceof NextResponse) return ctx;
  return handleCreate(portalWebhookCtx(ctx), request);
}
