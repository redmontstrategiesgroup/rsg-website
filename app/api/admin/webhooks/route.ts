import { NextResponse } from "next/server";
import { adminKeyGuard } from "@/lib/apiv1/route-guards";
import { adminWebhookCtx, handleCreate, handleList } from "@/lib/webhooks/cookie-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await adminKeyGuard();
  if (ctx instanceof NextResponse) return ctx;
  return handleList(adminWebhookCtx(ctx));
}

export async function POST(request: Request) {
  const ctx = await adminKeyGuard();
  if (ctx instanceof NextResponse) return ctx;
  return handleCreate(adminWebhookCtx(ctx), request);
}
