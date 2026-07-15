import { DateTime } from "luxon";
import { requireSupabase, siteUrl, adminTimezone } from "./db";
import { formatInZone } from "./availability";
import {
  getSettings,
  sendInternalNotification,
  sendTemplatedEmail,
} from "./notifications";
import { updateLeadStatus } from "./leads";
import { enqueueWebhook } from "./webhooks";
import { logActivity, trackSchedulingEvent } from "./analytics";

export async function enqueueReminderJobs(
  bookingId: string,
  appointmentTypeId: string,
  startsAtIso: string
) {
  const sb = requireSupabase();
  const { data: schedules } = await sb
    .from("reminder_schedules")
    .select("*")
    .eq("appointment_type_id", appointmentTypeId)
    .eq("enabled", true);

  const starts = DateTime.fromISO(startsAtIso, { zone: "utc" });
  const rows: {
    job_type: string;
    due_at: string | null;
    payload: Record<string, unknown>;
    status: string;
    booking_id: string;
  }[] = (schedules ?? []).map((s) => {
    const dueAt =
      s.offset_minutes === 0
        ? DateTime.utc()
        : starts.minus({ minutes: s.offset_minutes });
    return {
      job_type: s.offset_minutes === 0 ? "reminder_immediate" : "reminder",
      due_at: dueAt.toISO(),
      payload: {
        template_key: s.template_key,
        offset_minutes: s.offset_minutes,
        channel: s.channel,
      },
      status: "pending",
      booking_id: bookingId,
    };
  });

  // Follow-up after meeting
  rows.push({
    job_type: "follow_up",
    due_at: starts.plus({ hours: 2 }).toISO(),
    payload: { template_key: null },
    status: "pending",
    booking_id: bookingId,
  });

  // No-show check 30 min after start
  rows.push({
    job_type: "no_show_check",
    due_at: starts.plus({ minutes: 30 }).toISO(),
    payload: {},
    status: "pending",
    booking_id: bookingId,
  });

  if (rows.length) {
    await sb.from("notification_jobs").insert(rows);
  }
}

export async function processDueJobs(limit = 50) {
  const sb = requireSupabase();
  const now = new Date().toISOString();
  const { data: jobs } = await sb
    .from("notification_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(limit);

  if (!jobs?.length) {
    return { processed: 0 };
  }

  let processed = 0;
  const settings = await getSettings();

  for (const job of jobs) {
    await sb
      .from("notification_jobs")
      .update({ status: "processing", attempts: job.attempts + 1 })
      .eq("id", job.id);

    try {
      if (job.job_type === "reminder" || job.job_type === "reminder_immediate") {
        await sendReminder(job.booking_id, job.payload as { template_key?: string });
      } else if (job.job_type === "no_show_check") {
        await maybeMarkNoShow(job.booking_id);
      } else if (job.job_type === "abandon_follow_up") {
        await processAbandonFollowUp(job);
      } else if (job.job_type === "follow_up") {
        // Soft follow-up placeholder — only activity log (no spam)
        await logActivity({
          entityType: "booking",
          bookingId: job.booking_id,
          action: "post_meeting_window",
        });
      }

      await sb
        .from("notification_jobs")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      processed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Job failed";
      await sb
        .from("notification_jobs")
        .update({
          status: job.attempts + 1 >= 5 ? "failed" : "pending",
          last_error: message,
        })
        .eq("id", job.id);
    }
  }

  // Detect abandoned qualified sessions
  await detectAbandonedSessions(settings.abandon_hours ?? 24);

  return { processed, adminTimezone: settings.admin_timezone };
}

async function sendReminder(
  bookingId: string | null,
  payload: { template_key?: string }
) {
  if (!bookingId) return;
  const sb = requireSupabase();
  const { data: booking } = await sb
    .from("bookings")
    .select("*, appointment_types(*), leads(*)")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.status === "cancelled") return;

  const lead = booking.leads as Record<string, string> | null;
  if (!lead?.email) return;

  const type = booking.appointment_types as { name?: string } | null;
  const manageUrl = `${siteUrl()}/booking/manage/${booking.manage_token}`;
  await sendTemplatedEmail({
    templateKey: payload.template_key || "visitor_reminder",
    to: lead.email,
    vars: {
      first_name: lead.first_name ?? lead.name?.split(" ")[0] ?? "",
      appointment_type: type?.name ?? "Consultation",
      appointment_time_local: formatInZone(
        booking.starts_at,
        booking.visitor_timezone
      ),
      manage_url: manageUrl,
    },
    bookingId,
    leadId: booking.lead_id,
  });

  await enqueueWebhook("reminder.due", { bookingId });
  await trackSchedulingEvent({
    eventType: "reminder_sent",
    bookingId,
    leadId: booking.lead_id,
    isTest: booking.is_test,
  });
}

async function maybeMarkNoShow(bookingId: string | null) {
  if (!bookingId) return;
  const sb = requireSupabase();
  const { data: booking } = await sb
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return;
  if (!["confirmed", "rescheduled"].includes(booking.status)) return;
  // Only auto-flag if still not completed — admin can override
  // We don't auto-complete; mark no_show only if still open past start+30
  if (DateTime.fromISO(booking.starts_at) > DateTime.utc().minus({ minutes: 30 })) {
    return;
  }
  // Leave as confirmed unless admin marks — enqueue internal notice only
  const settings = await getSettings();
  await sendInternalNotification(
    "internal_no_show",
    {
      full_name: "",
      business_name: "",
      appointment_time_admin: formatInZone(
        booking.starts_at,
        settings.admin_timezone || adminTimezone()
      ),
    },
    { bookingId, leadId: booking.lead_id }
  );
}

async function detectAbandonedSessions(abandonHours: number) {
  const sb = requireSupabase();
  const cutoff = DateTime.utc().minus({ hours: abandonHours }).toISO();
  const { data: sessions } = await sb
    .from("booking_sessions")
    .select("*")
    .eq("qualification_outcome", "qualified")
    .is("completed_at", null)
    .is("abandoned_at", null)
    .lt("updated_at", cutoff)
    .limit(25);

  for (const session of sessions ?? []) {
    await sb
      .from("booking_sessions")
      .update({
        abandoned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    if (session.lead_id) {
      await updateLeadStatus(session.lead_id, "qualified_not_booked");
    }

    const contact = (session.contact ?? {}) as Record<string, string>;
    await sendInternalNotification(
      "internal_qualified_abandoned",
      {
        full_name: `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim(),
        business_name: contact.businessName ?? "",
        email: contact.email ?? "",
      },
      { leadId: session.lead_id }
    );

    await enqueueWebhook("lead.qualified_abandoned", {
      sessionId: session.id,
      leadId: session.lead_id,
    });

    await trackSchedulingEvent({
      eventType: "booking_abandoned",
      sessionId: session.id,
      leadId: session.lead_id,
      isTest: session.is_test,
    });

    // Optional visitor finish-booking email (once, if consent and under max)
    const settings = await getSettings();
    if (
      contact.email &&
      (session.follow_up_count ?? 0) < (settings.max_follow_ups ?? 1)
    ) {
      // consent stored on lead — check lead
      let allow = false;
      if (session.lead_id) {
        const { data: lead } = await sb
          .from("leads")
          .select("consent_at")
          .eq("id", session.lead_id)
          .maybeSingle();
        allow = Boolean(lead?.consent_at);
      }
      if (allow) {
        const finishUrl = `${siteUrl()}/book?session=${session.token}`;
        await sendTemplatedEmail({
          templateKey: "visitor_finish_booking",
          to: contact.email,
          vars: {
            first_name: contact.firstName ?? "",
            finish_booking_url: finishUrl,
          },
          leadId: session.lead_id,
        });
        await sb
          .from("booking_sessions")
          .update({
            follow_up_count: (session.follow_up_count ?? 0) + 1,
            booking_link_sent_at: new Date().toISOString(),
          })
          .eq("id", session.id);
      }
    }
  }
}

async function processAbandonFollowUp(job: {
  lead_id?: string | null;
  payload: unknown;
}) {
  await sendInternalNotification(
    "internal_qualified_abandoned",
    { full_name: "", business_name: "", email: "" },
    { leadId: job.lead_id ?? undefined }
  );
}
