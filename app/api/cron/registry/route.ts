import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { reconcileRegistry } from "@/lib/webhooks/registry-sync";
import { outboxHealth } from "@/lib/webhooks/outbox";
import { writeAuditEvent } from "@/lib/audit";
import {
  correlationFromRequest,
  recordInboundEvent,
  withCorrelation,
} from "@/lib/integration-log";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Nightly client-registry reconcile.
 *
 * Separate from the 5-minute scheduling cron on purpose. Ordinary delivery is
 * already handled there — registry events sit in the same outbox and go out
 * with everything else. This sweep exists for the case push cannot cover: an
 * app's Supabase project was paused or unreachable long enough that its
 * deliveries dead-lettered, and nothing would ever retry them.
 *
 * Running it on the frequent tick instead would rescan every client every five
 * minutes to find nothing, which is why it is daily.
 *
 * Authorize with: Authorization: Bearer $CRON_SECRET
 */
export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 503 });
  }
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  return withCorrelation(correlationFromRequest(request), async () => {
    // Heartbeat before the work, so a run that dies partway still proves the
    // cron fired and the failure is attributed to the step, not the schedule.
    await recordInboundEvent({
      provider: "internal",
      operation: "cron.registry.run",
      connectionId: "cron.registry",
    });

    const registry = await reconcileRegistry();
    const outbox = await outboxHealth();

    await writeAuditEvent({
      actorType: "cron",
      action: "cron.registry",
      metadata: { registry, outbox },
    });

    return NextResponse.json({
      ok: true,
      registry,
      outbox,
      at: new Date().toISOString(),
    });
  });
}

/** Vercel Cron uses GET by default. */
export async function GET(request: Request) {
  return POST(request);
}
