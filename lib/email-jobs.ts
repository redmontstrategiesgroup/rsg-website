/**
 * Durable outbound email retry queue (contact notifications, etc.).
 */

import { Resend } from "resend";
import { getSupabase } from "@/lib/supabase";
import {
  callProvider,
  ensureCorrelationId,
  IntegrationError,
  isRetryable,
  recordDeadLettered,
  recordSkipped,
  withCorrelation,
} from "@/lib/integration-log";

export type EmailJobPayload = {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  /**
   * The correlation id of the request that enqueued this job. Carried INSIDE
   * the payload on purpose: this is the boundary where correlation ids are
   * normally lost, leaving the request half of an incident traceable and the
   * delivery half orphaned. Every send attempt for this job — including all
   * retries, hours later — logs under this id.
   */
  correlationId?: string;
};

export async function enqueueEmailJob(
  kind: string,
  payload: EmailJobPayload
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.from("email_jobs").insert({
      kind,
      payload: {
        ...payload,
        correlationId: payload.correlationId ?? ensureCorrelationId(),
      },
      status: "pending",
      next_attempt_at: new Date().toISOString(),
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("[email-jobs] enqueue failed", err);
    return false;
  }
}

export async function processEmailJobs(limit = 20): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const sb = getSupabase();
  const apiKey = process.env.RESEND_API_KEY;
  if (!sb || !apiKey) {
    // Previously a bare return: the entire queue stopped draining and said
    // nothing. A missing key is exactly the "nobody noticed for three weeks"
    // failure, so make it visible in the call log.
    await recordSkipped(
      { provider: "resend", operation: "email.queue.drain" },
      !apiKey ? "RESEND_API_KEY not set" : "Supabase not configured"
    );
    return { processed: 0, sent: 0, failed: 0 };
  }

  const { data: jobs, error } = await sb
    .from("email_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);

  if (error || !jobs?.length) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  const resend = new Resend(apiKey);
  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    const attempts = (job.attempts as number) + 1;
    const payload = job.payload as EmailJobPayload;
    const max = (job.max_attempts as number) || 5;
    // Resume under the enqueuing request's id — same id across every attempt,
    // so all of them group into one story during a triage.
    const correlationId = ensureCorrelationId(payload.correlationId);

    try {
      await withCorrelation(correlationId, () =>
        callProvider(
          {
            provider: "resend",
            operation: `email.send.${job.kind ?? "unknown"}`,
            correlationId,
            attempt: attempts,
            // Not the final attempt → this failure is a retry, not an outage.
            willRetry: attempts < max,
          },
          async () => {
            const { data, error: sendError } = await resend.emails.send({
              from: payload.from,
              to: payload.to,
              ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
              subject: payload.subject,
              html: payload.html,
              text: payload.text,
            });
            // Resend returns errors in-band rather than throwing. Rethrow with
            // the status attached so classifyError can read it.
            if (sendError) {
              throw Object.assign(new Error(sendError.message), {
                name: sendError.name,
                status: (sendError as { statusCode?: number }).statusCode,
              });
            }
            return data;
          }
        )
      );

      await sb
        .from("email_jobs")
        .update({
          status: "sent",
          attempts,
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", job.id);
      sent += 1;
    } catch (err) {
      const integration = err instanceof IntegrationError ? err : null;
      const message = err instanceof Error ? err.message : "send failed";

      // A validation failure (malformed address, rejected domain) will fail
      // identically on every retry. Burning four more attempts on it delays
      // the queue and buries the real cause under duplicate noise.
      const permanent = integration ? !isRetryable(integration.errorClass) : false;
      const done = permanent || attempts >= max;

      if (done) {
        await recordDeadLettered({
          provider: "resend",
          operation: `email.send.${job.kind ?? "unknown"}`,
          correlationId,
          attempt: attempts,
          errorClass: integration?.errorClass ?? "our_bug",
          errorMessage: permanent
            ? `Not retried — ${integration?.errorClass ?? "unknown"} is permanent. ${message}`
            : message,
        });
      }

      const backoffMin = Math.min(60, 2 ** attempts);
      await sb
        .from("email_jobs")
        .update({
          status: done ? "failed" : "pending",
          attempts,
          last_error: message.slice(0, 500),
          next_attempt_at: new Date(
            Date.now() + backoffMin * 60_000
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      failed += 1;
    }
  }

  return { processed: jobs.length, sent, failed };
}

/** Delete leads older than retentionDays that are spam/archived. */
export async function runLeadRetention(retentionDays = 730): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const cutoff = new Date(
    Date.now() - retentionDays * 24 * 60 * 60_000
  ).toISOString();
  try {
    const { data, error } = await sb
      .from("leads")
      .delete()
      .in("status", ["spam", "archived", "lost"])
      .lt("created_at", cutoff)
      .select("id");
    if (error) throw error;
    return data?.length ?? 0;
  } catch (err) {
    console.warn("[retention] lead cleanup failed", err);
    return 0;
  }
}
