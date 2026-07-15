/**
 * Durable outbound email retry queue (contact notifications, etc.).
 */

import { Resend } from "resend";
import { getSupabase } from "@/lib/supabase";

export type EmailJobPayload = {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
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
      payload,
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
  if (!sb || !apiKey) return { processed: 0, sent: 0, failed: 0 };

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
    try {
      const { error: sendError } = await resend.emails.send({
        from: payload.from,
        to: payload.to,
        ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      if (sendError) throw new Error(sendError.message);

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
      const max = (job.max_attempts as number) || 5;
      const message = err instanceof Error ? err.message : "send failed";
      const done = attempts >= max;
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
