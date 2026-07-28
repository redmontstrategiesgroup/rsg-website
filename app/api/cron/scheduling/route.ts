import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { processDueJobs } from "@/lib/scheduling/reminders";
import { deliverPendingWebhooks } from "@/lib/scheduling/webhooks";
import { emitTombstones } from "@/lib/webhooks/registry-sync";
import { isSupabaseConfigured } from "@/lib/supabase";
import { processEmailJobs, runLeadRetention } from "@/lib/email-jobs";
import { runLifecycleCron } from "@/lib/lifecycle/orchestrate";
import { writeAuditEvent } from "@/lib/audit";
import {
  correlationFromRequest,
  recordInboundEvent,
  withCorrelation,
} from "@/lib/integration-log";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron entrypoint for reminders, abandon detection, webhook retries,
 * contact email retries, and light retention.
 * Authorize with: Authorization: Bearer $CRON_SECRET
 */
export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured." },
      { status: 503 }
    );
  }

  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 503 }
    );
  }

  // One correlation id for the whole run, so every email sent, webhook
  // delivered, and reminder fired by this tick shares it. Without this each
  // background send would mint its own id and the run could not be
  // reconstructed from the far side of a failure.
  return withCorrelation(correlationFromRequest(request), () => runCron());
}

async function runCron() {
  // Heartbeat. Everything below runs ONLY from this cron, so if it stops
  // firing — a removed vercel.json entry, a rotated CRON_SECRET, a suspended
  // project — the email queue stops draining and reminders stop sending with
  // no error anywhere. This touch is what makes that visible: the health
  // endpoint alerts when it goes stale (expected every 300s).
  //
  // Recorded BEFORE the work so a run that dies partway still proves the cron
  // is alive, and the failing step is attributed to the step, not the cron.
  await recordInboundEvent({
    provider: "internal",
    operation: "cron.scheduling.run",
    connectionId: "cron.scheduling",
  });

  const jobs = await processDueJobs(50);
  const webhooks = await deliverPendingWebhooks(20);
  // Client deletions must reach the per-app registry mirrors promptly — a
  // client deleted here but still live in five app databases is a data-retention
  // problem, not a sync latency one. Cheap: normally selects zero rows.
  const tombstones = await emitTombstones();
  const emails = await processEmailJobs(20);
  const retained = await runLeadRetention(730);
  // Lifecycle sweeps (reminders, expirations, delayed automations) never
  // throw — failures are reported in the counts.
  const lifecycle = await runLifecycleCron();

  await writeAuditEvent({
    actorType: "cron",
    action: "cron.scheduling",
    metadata: { jobs, webhooks, tombstones, emails, retained, lifecycle },
  });

  return NextResponse.json({
    ok: true,
    jobs,
    webhooks,
    tombstones,
    emails,
    retained,
    lifecycle,
    at: new Date().toISOString(),
  });
}

/** Vercel Cron uses GET by default. */
export async function GET(request: Request) {
  return POST(request);
}
