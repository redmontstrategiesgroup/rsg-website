import { DateTime } from "luxon";
import { randomUUID } from "node:crypto";
import { requireSupabase, adminTimezone, siteUrl } from "./db";
import { createSecureToken, createIcalUid } from "./tokens";
import { getAppointmentTypeById, getDefaultTeamMember } from "./catalog";
import { isSlotAvailable } from "./slots";
import { updateLeadStatus } from "./leads";
import { logActivity, trackSchedulingEvent } from "./analytics";
import {
  buildBookingIcsAttachment,
  getSettings,
  sendInternalNotification,
  sendTemplatedEmail,
} from "./notifications";
import { formatInZone } from "./availability";
import { enqueueReminderJobs } from "./reminders";
import { enqueueWebhook } from "./webhooks";
import {
  googleCalendarUrl,
  outlookCalendarUrl,
  office365CalendarUrl,
} from "./ics";
import type { MeetingFormat } from "./types";

export async function createBooking(input: {
  sessionId: string;
  sessionToken: string;
  appointmentTypeId: string;
  startsAt: string;
  meetingFormat: MeetingFormat;
  visitorTimezone: string;
  visitorNotes?: string;
  idempotencyKey?: string;
}): Promise<
  | { ok: true; bookingId: string; manageToken: string }
  | { ok: false; error: string; code?: string }
> {
  const sb = requireSupabase();
  const settings = await getSettings();
  if (settings.bookings_paused) {
    return { ok: false, error: "Bookings are temporarily paused.", code: "paused" };
  }

  if (input.idempotencyKey) {
    const { data: existing } = await sb
      .from("bookings")
      .select("id, manage_token")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        bookingId: existing.id,
        manageToken: existing.manage_token,
      };
    }
  }

  const { data: session } = await sb
    .from("booking_sessions")
    .select("*")
    .eq("id", input.sessionId)
    .eq("token", input.sessionToken)
    .maybeSingle();

  if (!session) return { ok: false, error: "Session not found.", code: "session" };
  if (new Date(session.expires_at) < new Date()) {
    return { ok: false, error: "Session expired.", code: "expired" };
  }
  if (session.qualification_outcome !== "qualified" && !session.is_test) {
    // Allow calendar only when qualified (or admin override stored on session)
    const { data: rule } = await sb
      .from("qualification_rule_sets")
      .select("allow_calendar_on_manual_review")
      .eq("status", "published")
      .limit(1)
      .maybeSingle();
    if (
      !(
        session.qualification_outcome === "manual_review" &&
        rule?.allow_calendar_on_manual_review
      )
    ) {
      return {
        ok: false,
        error: "Not eligible to book at this time.",
        code: "not_eligible",
      };
    }
  }

  const type = await getAppointmentTypeById(input.appointmentTypeId);
  if (!type || !type.active) {
    return { ok: false, error: "Appointment type unavailable.", code: "type" };
  }

  const member = type.team_member_id
    ? (
        await sb
          .from("team_members")
          .select("*")
          .eq("id", type.team_member_id)
          .maybeSingle()
      ).data
    : await getDefaultTeamMember();

  if (!member) {
    return { ok: false, error: "No team member available.", code: "member" };
  }

  const starts = DateTime.fromISO(input.startsAt, { zone: "utc" });
  if (!starts.isValid) {
    return { ok: false, error: "Invalid start time.", code: "time" };
  }
  const ends = starts.plus({ minutes: type.duration_minutes });
  const startsISO = starts.toUTC().toISO()!;
  const endsISO = ends.toUTC().toISO()!;

  const available = await isSlotAvailable({
    appointmentTypeId: type.id,
    teamMemberId: member.id,
    startsAt: startsISO,
    endsAt: endsISO,
  });
  if (!available) {
    return {
      ok: false,
      error: "That time is no longer available. Please choose another slot.",
      code: "conflict",
    };
  }

  const manageToken = createSecureToken(32);
  const icalUid = createIcalUid();
  const bookingId = randomUUID();
  const contact = (session.contact ?? {}) as Record<string, string>;
  const firstName = contact.firstName ?? "";
  const lastName = contact.lastName ?? "";
  const email = contact.email ?? "";
  const fullName = `${firstName} ${lastName}`.trim();

  const { error: insertError } = await sb.from("bookings").insert({
    id: bookingId,
    lead_id: session.lead_id,
    session_id: session.id,
    appointment_type_id: type.id,
    team_member_id: member.id,
    service_id: session.service_id,
    starts_at: startsISO,
    ends_at: endsISO,
    visitor_timezone: input.visitorTimezone,
    admin_timezone: settings.admin_timezone || adminTimezone(),
    meeting_format: input.meetingFormat,
    meeting_location: type.location,
    status: "confirmed",
    manage_token: manageToken,
    ical_uid: icalUid,
    ical_sequence: 0,
    idempotency_key: input.idempotencyKey ?? null,
    visitor_notes: input.visitorNotes ?? null,
    is_test: session.is_test ?? false,
  });

  if (insertError) {
    // Concurrent duplicate submit (double-click): the other request already
    // created this booking — return it instead of failing.
    if (
      input.idempotencyKey &&
      /bookings_idempotency_uidx/i.test(insertError.message)
    ) {
      const { data: existing } = await sb
        .from("bookings")
        .select("id, manage_token")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      if (existing) {
        return {
          ok: true,
          bookingId: existing.id,
          manageToken: existing.manage_token,
        };
      }
    }
    if (/bookings_no_overlap|exclusion|23P01/i.test(insertError.message)) {
      return {
        ok: false,
        error: "That time was just booked. Please choose another slot.",
        code: "conflict",
      };
    }
    console.error("[booking] insert failed", insertError);
    return { ok: false, error: "Unable to create booking.", code: "db" };
  }

  await sb.from("booking_attendees").insert([
    {
      booking_id: bookingId,
      role: "visitor",
      name: fullName,
      email,
      phone: contact.phone ?? null,
    },
    {
      booking_id: bookingId,
      role: "host",
      name: member.name,
      email: member.email,
    },
  ]);

  await sb.from("booking_changes").insert({
    booking_id: bookingId,
    change_type: "created",
    actor: "visitor",
    after_snapshot: { starts_at: startsISO, ends_at: endsISO },
  });

  if (session.lead_id) {
    await updateLeadStatus(session.lead_id, "appointment_booked");
  }

  await sb
    .from("booking_sessions")
    .update({
      completed_at: new Date().toISOString(),
      appointment_type_id: type.id,
      meeting_format: input.meetingFormat,
      timezone: input.visitorTimezone,
      step: "confirmed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  await logActivity({
    entityType: "booking",
    entityId: bookingId,
    leadId: session.lead_id ?? undefined,
    bookingId,
    action: "booking_created",
    actor: "visitor",
  });

  await trackSchedulingEvent({
    eventType: "booking_created",
    sessionId: session.id,
    leadId: session.lead_id ?? undefined,
    bookingId,
    serviceId: session.service_id ?? undefined,
    appointmentTypeId: type.id,
    isTest: session.is_test,
  });

  const manageUrl = `${siteUrl()}/booking/manage/${manageToken}`;
  const timeLocal = formatInZone(startsISO, input.visitorTimezone);
  const timeAdmin = formatInZone(
    startsISO,
    settings.admin_timezone || adminTimezone()
  );

  const ics = buildBookingIcsAttachment({
    uid: icalUid,
    sequence: 0,
    title: `${type.name} — Redmont Strategies Group`,
    description: type.public_description || type.name,
    location: input.meetingFormat,
    startsAt: startsISO,
    endsAt: endsISO,
    attendeeEmail: email,
    attendeeName: fullName,
    manageUrl,
  });

  let serviceName = "";
  if (session.service_id) {
    const { data: svc } = await sb
      .from("services")
      .select("name")
      .eq("id", session.service_id)
      .maybeSingle();
    serviceName = svc?.name ?? "";
  }
  const answers = (session.answers ?? {}) as Record<string, unknown>;
  const attribution = (session.attribution ?? {}) as Record<string, string>;

  const vars = {
    first_name: firstName,
    full_name: fullName,
    business_name: contact.businessName ?? "",
    email,
    phone: contact.phone ?? "",
    website: contact.website ?? "",
    industry: contact.industry ?? "",
    service: serviceName,
    preferred_contact: contact.preferredContact ?? "",
    improvement_note:
      typeof answers.problem === "string" ? answers.problem : "",
    visitor_notes: input.visitorNotes ?? "",
    page_url: attribution.pageUrl ?? "",
    appointment_type: type.name,
    appointment_time_local: timeLocal,
    appointment_time_admin: timeAdmin,
    timezone: input.visitorTimezone,
    meeting_format: input.meetingFormat,
    manage_url: manageUrl,
    qualification_score: session.qualification_score ?? "",
    qualification_outcome: session.qualification_outcome ?? "",
    lead_source: "website_booking_funnel",
    book_url: `${siteUrl()}/book`,
  };

  if (email) {
    await sendTemplatedEmail({
      templateKey: "visitor_booking_confirmation",
      to: email,
      vars,
      bookingId,
      leadId: session.lead_id ?? undefined,
      ics,
    });
  }

  await sendInternalNotification("internal_booking_created", vars, {
    leadId: session.lead_id ?? undefined,
    bookingId,
  });

  await enqueueReminderJobs(bookingId, type.id, startsISO);
  await enqueueWebhook(
    "booking.created",
    { bookingId, leadId: session.lead_id, startsAt: startsISO },
    // A booking is created once, so its id is the whole identity.
    { eventId: `booking.created:${bookingId}` }
  );

  return { ok: true, bookingId, manageToken };
}

export async function getBookingByManageToken(token: string) {
  const sb = requireSupabase();
  const { data: booking } = await sb
    .from("bookings")
    .select("*, appointment_types(*), team_members(*), leads(*)")
    .eq("manage_token", token)
    .maybeSingle();
  return booking;
}

export async function rescheduleBooking(input: {
  manageToken: string;
  startsAt: string;
  visitorTimezone?: string;
  actor?: string;
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const sb = requireSupabase();
  const settings = await getSettings();
  const booking = await getBookingByManageToken(input.manageToken);
  if (!booking) return { ok: false, error: "Booking not found.", code: "not_found" };
  if (booking.status === "cancelled") {
    return { ok: false, error: "Booking is cancelled.", code: "cancelled" };
  }

  const cutoff = settings.reschedule_cutoff_minutes ?? 240;
  if (
    DateTime.fromISO(booking.starts_at) <
    DateTime.utc().plus({ minutes: cutoff })
  ) {
    return {
      ok: false,
      error: "This appointment can no longer be rescheduled online.",
      code: "cutoff",
    };
  }

  const type = await getAppointmentTypeById(booking.appointment_type_id);
  if (!type) return { ok: false, error: "Appointment type missing.", code: "type" };

  const starts = DateTime.fromISO(input.startsAt, { zone: "utc" });
  const ends = starts.plus({ minutes: type.duration_minutes });
  const startsISO = starts.toUTC().toISO()!;
  const endsISO = ends.toUTC().toISO()!;

  const available = await isSlotAvailable({
    appointmentTypeId: type.id,
    teamMemberId: booking.team_member_id,
    startsAt: startsISO,
    endsAt: endsISO,
  });
  // Current booking occupies its own slot — check excluding self
  const sbCheck = requireSupabase();
  const { data: conflicts } = await sbCheck
    .from("bookings")
    .select("id")
    .eq("team_member_id", booking.team_member_id)
    .in("status", ["confirmed", "rescheduled"])
    .neq("id", booking.id)
    .lt("starts_at", endsISO)
    .gt("ends_at", startsISO);

  if ((conflicts?.length ?? 0) > 0 && !available) {
    // If the only conflict is ourselves filtered out, allow; else reject
  }
  if (conflicts && conflicts.length > 0) {
    return {
      ok: false,
      error: "That time is no longer available.",
      code: "conflict",
    };
  }

  // Also verify against generated slots OR empty conflicts
  if (!available) {
    // Slot generator counts this booking; verify no other conflict already done
    const stillOk = !(conflicts && conflicts.length > 0);
    if (!stillOk) {
      return { ok: false, error: "That time is no longer available.", code: "conflict" };
    }
  }

  const before = { starts_at: booking.starts_at, ends_at: booking.ends_at };
  const { error } = await sb
    .from("bookings")
    .update({
      starts_at: startsISO,
      ends_at: endsISO,
      status: "rescheduled",
      rescheduled_from: booking.starts_at,
      ical_sequence: (booking.ical_sequence ?? 0) + 1,
      visitor_timezone: input.visitorTimezone ?? booking.visitor_timezone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (error) {
    if (/bookings_no_overlap|exclusion|23P01/i.test(error.message)) {
      return { ok: false, error: "That time is no longer available.", code: "conflict" };
    }
    return { ok: false, error: "Unable to reschedule.", code: "db" };
  }

  await sb.from("booking_changes").insert({
    booking_id: booking.id,
    change_type: "rescheduled",
    actor: input.actor ?? "visitor",
    before_snapshot: before,
    after_snapshot: { starts_at: startsISO, ends_at: endsISO },
  });

  if (booking.lead_id) {
    await updateLeadStatus(booking.lead_id, "rescheduled");
  }

  // Cancel old reminder jobs and enqueue new
  await sb
    .from("notification_jobs")
    .update({ status: "cancelled" })
    .eq("booking_id", booking.id)
    .eq("status", "pending");
  await enqueueReminderJobs(booking.id, type.id, startsISO);

  const lead = booking.leads as Record<string, string> | null;
  const manageUrl = `${siteUrl()}/booking/manage/${booking.manage_token}`;
  const timeLocal = formatInZone(
    startsISO,
    input.visitorTimezone ?? booking.visitor_timezone
  );
  const vars = {
    first_name: lead?.first_name ?? lead?.name?.split(" ")[0] ?? "",
    full_name: lead?.name ?? "",
    business_name: lead?.business_name ?? "",
    appointment_type: type.name,
    appointment_time_local: timeLocal,
    appointment_time_admin: formatInZone(
      startsISO,
      settings.admin_timezone || adminTimezone()
    ),
    manage_url: manageUrl,
    email: lead?.email ?? "",
  };

  const ics = buildBookingIcsAttachment({
    uid: booking.ical_uid,
    sequence: (booking.ical_sequence ?? 0) + 1,
    title: `${type.name} — Redmont Strategies Group`,
    description: type.public_description || type.name,
    startsAt: startsISO,
    endsAt: endsISO,
    attendeeEmail: lead?.email ?? "",
    attendeeName: lead?.name ?? "",
    manageUrl,
  });

  if (lead?.email) {
    await sendTemplatedEmail({
      templateKey: "visitor_reschedule",
      to: lead.email,
      vars,
      bookingId: booking.id,
      leadId: booking.lead_id,
      ics,
    });
  }
  await sendInternalNotification("internal_reschedule", vars, {
    leadId: booking.lead_id,
    bookingId: booking.id,
  });
  await enqueueWebhook(
    "booking.rescheduled",
    { bookingId: booking.id, startsAt: startsISO },
    // The new start time is part of the identity: a booking can be rescheduled
    // repeatedly, and keying on the booking id alone would dedupe every
    // reschedule after the first into nothing.
    { eventId: `booking.rescheduled:${booking.id}:${startsISO}` }
  );

  return { ok: true };
}

export async function cancelBooking(input: {
  manageToken: string;
  reason?: string;
  actor?: string;
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const sb = requireSupabase();
  const settings = await getSettings();
  const booking = await getBookingByManageToken(input.manageToken);
  if (!booking) return { ok: false, error: "Booking not found.", code: "not_found" };
  if (booking.status === "cancelled") return { ok: true };

  const cutoff = settings.cancel_cutoff_minutes ?? 240;
  if (
    input.actor !== "admin" &&
    DateTime.fromISO(booking.starts_at) <
      DateTime.utc().plus({ minutes: cutoff })
  ) {
    return {
      ok: false,
      error: "This appointment can no longer be cancelled online.",
      code: "cutoff",
    };
  }

  const type = booking.appointment_type_id
    ? await getAppointmentTypeById(booking.appointment_type_id)
    : null;

  await sb
    .from("bookings")
    .update({
      status: "cancelled",
      cancellation_reason: input.reason ?? null,
      cancelled_at: new Date().toISOString(),
      ical_sequence: (booking.ical_sequence ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  await sb.from("booking_changes").insert({
    booking_id: booking.id,
    change_type: "cancelled",
    actor: input.actor ?? "visitor",
    note: input.reason,
  });

  await sb
    .from("notification_jobs")
    .update({ status: "cancelled" })
    .eq("booking_id", booking.id)
    .eq("status", "pending");

  if (booking.lead_id) {
    await updateLeadStatus(booking.lead_id, "cancelled");
  }

  const lead = booking.leads as Record<string, string> | null;
  const manageUrl = `${siteUrl()}/booking/manage/${booking.manage_token}`;
  const vars = {
    first_name: lead?.first_name ?? "",
    full_name: lead?.name ?? "",
    business_name: lead?.business_name ?? "",
    appointment_type: type?.name ?? "Consultation",
    book_url: `${siteUrl()}/book`,
    manage_url: manageUrl,
    appointment_time_admin: formatInZone(
      booking.starts_at,
      settings.admin_timezone || adminTimezone()
    ),
  };

  if (lead?.email && type) {
    const ics = buildBookingIcsAttachment({
      uid: booking.ical_uid,
      sequence: (booking.ical_sequence ?? 0) + 1,
      title: `${type.name} — Redmont Strategies Group`,
      description: "Cancelled",
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      attendeeEmail: lead.email,
      attendeeName: lead.name ?? "",
      manageUrl,
      cancelled: true,
    });
    await sendTemplatedEmail({
      templateKey: "visitor_cancellation",
      to: lead.email,
      vars,
      bookingId: booking.id,
      leadId: booking.lead_id,
      ics,
    });
  }

  await sendInternalNotification("internal_cancellation", vars, {
    leadId: booking.lead_id,
    bookingId: booking.id,
  });
  await enqueueWebhook(
    "booking.cancelled",
    { bookingId: booking.id },
    // Cancellation is terminal — it happens at most once per booking.
    { eventId: `booking.cancelled:${booking.id}` }
  );

  return { ok: true };
}

export function calendarLinksForBooking(booking: {
  starts_at: string;
  ends_at: string;
  meeting_format?: string;
  appointment_types?: { name?: string; public_description?: string } | null;
}) {
  const title = `${booking.appointment_types?.name ?? "Consultation"} — Redmont Strategies Group`;
  const description =
    booking.appointment_types?.public_description ??
    "Redmont Strategies Group consultation";
  const location = booking.meeting_format ?? "";
  return {
    google: googleCalendarUrl({
      title,
      description,
      location,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
    }),
    outlook: outlookCalendarUrl({
      title,
      description,
      location,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
    }),
    office365: office365CalendarUrl({
      title,
      description,
      location,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
    }),
  };
}
