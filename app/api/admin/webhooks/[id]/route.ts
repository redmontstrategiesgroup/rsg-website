import { NextResponse } from "next/server";
import { adminKeyGuard } from "@/lib/apiv1/route-guards";
import { adminWebhookCtx, handleDelete, handlePatch } from "@/lib/webhooks/cookie-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await adminKeyGuard();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await context.params;
  return handlePatch(adminWebhookCtx(ctx), request, id);
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await adminKeyGuard();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await context.params;
  return handleDelete(adminWebhookCtx(ctx), id);
}
