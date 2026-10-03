import { NextResponse } from "next/server";
import { isAdminContext, requireAdmin } from "@/lib/admin-auth";
import { rateLimit, rateLimitResponse } from "@/lib/security";
import { PocketNotConfiguredError } from "@/lib/pocket/client";
import { syncFromPocket } from "@/lib/pocket/recordings";

export const runtime = "nodejs";
// Up to 25 detail fetches plus a few Claude fallback summaries per run.
export const maxDuration = 300;

/** Pull new and changed recordings from the Pocket API. */
export async function POST() {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  if (!(await rateLimit(`pocket:sync:${ctx.admin.id}`, 10, 10 * 60_000))) {
    return rateLimitResponse();
  }

  try {
    return NextResponse.json({ result: await syncFromPocket() });
  } catch (err) {
    if (err instanceof PocketNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[/api/admin/pocket/sync]", err);
    const message = (err as { userMessage?: string }).userMessage;
    return NextResponse.json(
      { error: message ? `Pocket sync failed: ${message}` : "Pocket sync failed." },
      { status: 502 },
    );
  }
}
