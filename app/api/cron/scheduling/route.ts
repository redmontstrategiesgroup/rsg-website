import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processDueJobs } from "@/lib/scheduling/reminders";
import { deliverPendingWebhooks } from "@/lib/scheduling/webhooks";
import { isSupabaseConfigured } from "@/lib/supabase";
import { processEmailJobs, runLeadRetention } from "@/lib/email-jobs";
import { runLifecycleCron } from "@/lib/lifecycle/orchestrate";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

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

  const jobs = await processDueJobs(50);
  const webhooks = await deliverPendingWebhooks(20);
  const emails = await processEmailJobs(20);
  const retained = await runLeadRetention(730);
  // Lifecycle sweeps (reminders, expirations, delayed automations) never
  // throw — failures are reported in the counts.
  const lifecycle = await runLifecycleCron();

  await writeAuditEvent({
    actorType: "cron",
    action: "cron.scheduling",
    metadata: { jobs, webhooks, emails, retained, lifecycle },
  });

  return NextResponse.json({
    ok: true,
    jobs,
    webhooks,
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
