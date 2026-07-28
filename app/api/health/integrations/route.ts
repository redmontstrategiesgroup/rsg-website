import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { resolveAdminContext } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Integration health — the endpoint that answers "is anything quietly broken"
 * WITHOUT waiting for an error to be thrown.
 *
 * The failures that hurt produce no errors at all: a sync that stopped three
 * weeks ago, a webhook whose endpoint was revoked, a job queue that has been
 * draining zero rows since an env var was dropped on a deploy. None of those
 * log anything. All of them show up here, as a timestamp that stopped moving.
 *
 * Every threshold below reads PER CONNECTION. An aggregate failure rate is
 * useless for this: one connection failing 100% hides inside a healthy average
 * and never crosses an alert line.
 *
 * Auth: admin session, or `Authorization: Bearer $CRON_SECRET` so an uptime
 * monitor can poll it. Never public — it names providers and failure detail.
 */

type HealthRow = {
  provider: string;
  connection_id: string;
  tenant_id: string | null;
  status: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_attempt_at: string | null;
  consecutive_failures: number;
  last_error_class: string | null;
  last_error_message: string | null;
  expected_interval_seconds: number | null;
  seconds_since_success: number | null;
  is_stale: boolean;
};

function authorizedBySecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") || "";
  const a = Buffer.from(auth);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Window for the recent-failure rollup — long enough to see a slow burn. */
const RECENT_WINDOW_MINUTES = 60;

export async function GET(request: Request) {
  const admin = await resolveAdminContext();
  if (!admin && !authorizedBySecret(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "supabase_unconfigured" },
      { status: 503 }
    );
  }

  const sb = getSupabase()!;
  const since = new Date(
    Date.now() - RECENT_WINDOW_MINUTES * 60_000
  ).toISOString();

  try {
    const [{ data: health, error: healthError }, { data: recent, error: recentError }] =
      await Promise.all([
        sb.from("integration_health").select("*"),
        sb
          .from("integration_runs")
          .select("provider, connection_id, outcome, error_class, ts")
          .gte("ts", since)
          .limit(5000),
      ]);

    if (healthError) throw healthError;
    if (recentError) throw recentError;

    const connections = (health ?? []) as HealthRow[];
    const runs = (recent ?? []) as {
      provider: string;
      connection_id: string;
      outcome: string;
      error_class: string | null;
    }[];

    // Per-connection failure counts. Deliberately not divided into a single
    // system-wide rate — that number is the one that never alerts.
    const perConnection = new Map<
      string,
      { total: number; failed: number; deadLettered: number }
    >();
    for (const run of runs) {
      const key = `${run.provider}:${run.connection_id}`;
      const bucket =
        perConnection.get(key) ?? { total: 0, failed: 0, deadLettered: 0 };
      bucket.total += 1;
      if (run.outcome === "failed") bucket.failed += 1;
      if (run.outcome === "dead_lettered") bucket.deadLettered += 1;
      perConnection.set(key, bucket);
    }

    const detail = connections.map((c) => {
      const recentCounts =
        perConnection.get(`${c.provider}:${c.connection_id}`) ??
        { total: 0, failed: 0, deadLettered: 0 };
      return {
        provider: c.provider,
        connection: c.connection_id,
        tenantId: c.tenant_id,
        status: c.status,
        lastSuccessAt: c.last_success_at,
        lastFailureAt: c.last_failure_at,
        secondsSinceSuccess: c.seconds_since_success,
        consecutiveFailures: c.consecutive_failures,
        lastErrorClass: c.last_error_class,
        lastError: c.last_error_message,
        stale: c.is_stale,
        recentWindowMinutes: RECENT_WINDOW_MINUTES,
        recentCalls: recentCounts.total,
        recentFailures: recentCounts.failed,
        recentDeadLettered: recentCounts.deadLettered,
      };
    });

    // The four conditions worth waking someone for, each per connection.
    const needsReauth = detail.filter((d) => d.status === "needs_reauth");
    const stale = detail.filter((d) => d.stale);
    const down = detail.filter((d) => d.status === "down");
    const deadLettered = detail.filter((d) => d.recentDeadLettered > 0);

    const alerts = [
      // Silence here is why integrations stay broken for months.
      ...needsReauth.map((d) => ({
        severity: "critical" as const,
        kind: "needs_reauth" as const,
        provider: d.provider,
        connection: d.connection,
        message: `${d.provider}/${d.connection} needs re-authorization — ${d.lastErrorClass}.`,
      })),
      ...down.map((d) => ({
        severity: "critical" as const,
        kind: "down" as const,
        provider: d.provider,
        connection: d.connection,
        message: `${d.provider}/${d.connection} has failed ${d.consecutiveFailures} times consecutively.`,
      })),
      // A connection that stopped succeeding generates no errors at all.
      ...stale.map((d) => ({
        severity: "warning" as const,
        kind: "stale" as const,
        provider: d.provider,
        connection: d.connection,
        message: d.lastSuccessAt
          ? `${d.provider}/${d.connection} has not succeeded in ${Math.round(
              (d.secondsSinceSuccess ?? 0) / 60
            )} minutes.`
          : `${d.provider}/${d.connection} has never recorded a success.`,
      })),
      // Sustained non-zero DLQ arrivals is its own alert — these are the
      // operations that gave up entirely and need a human.
      ...deadLettered.map((d) => ({
        severity: "critical" as const,
        kind: "dead_lettered" as const,
        provider: d.provider,
        connection: d.connection,
        message: `${d.provider}/${d.connection} dead-lettered ${d.recentDeadLettered} operation(s) in the last ${RECENT_WINDOW_MINUTES}m — needs manual reconciliation.`,
      })),
    ];

    const ok = alerts.every((a) => a.severity !== "critical");

    return NextResponse.json(
      {
        ok,
        at: new Date().toISOString(),
        // A monitor can alert on this array alone and ignore everything else.
        alerts,
        connections: detail,
      },
      // Non-200 so an uptime monitor treats a critical alert as a page
      // without needing to parse the body.
      { status: ok ? 200 : 503 }
    );
  } catch (err) {
    console.error("[health/integrations]", err);
    return NextResponse.json(
      { ok: false, reason: "health_query_failed" },
      { status: 503 }
    );
  }
}
