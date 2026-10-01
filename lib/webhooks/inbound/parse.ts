import type { Lead } from "@/lib/types";

/**
 * Pure payload interpretation for inbound provider webhooks. Nothing here
 * trusts the payload beyond picking fields out of it: strings are trimmed and
 * length-capped, and anything malformed yields "ignore" rather than a throw.
 */

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : null;
}

function str(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

// ---------------------------------------------------------------------------
// Resend
// ---------------------------------------------------------------------------

export type ResendAction =
  | { kind: "suppress"; emails: string[]; reason: string }
  | { kind: "log"; reason: string }
  | { kind: "ignore" };

/**
 * Hard bounces, spam complaints and Resend-side suppressions mean the address
 * must never be mailed again, so they suppress. Soft bounces, failures and
 * delays are logged only: they are transient or our problem, not the
 * recipient's.
 */
export function resendAction(payload: unknown): ResendAction {
  const root = obj(payload);
  const type = str(root?.type, 100);
  const data = obj(root?.data);
  if (!type || !data) return { kind: "ignore" };

  const to = Array.isArray(data.to) ? data.to : [data.to];
  const emails = [
    ...new Set(to.map((t) => str(t, 254).toLowerCase()).filter(isEmail)),
  ];

  switch (type) {
    case "email.bounced": {
      const bounceType = str(obj(data.bounce)?.type, 50).toLowerCase();
      if (bounceType === "permanent" && emails.length) {
        return { kind: "suppress", emails, reason: "hard_bounce" };
      }
      return { kind: "log", reason: `bounce:${bounceType || "unknown"}` };
    }
    case "email.complained":
      return emails.length ? { kind: "suppress", emails, reason: "complaint" } : { kind: "ignore" };
    case "email.suppressed":
      return emails.length ? { kind: "suppress", emails, reason: "provider_suppressed" } : { kind: "ignore" };
    case "email.failed":
    case "email.delivery_delayed":
      return { kind: "log", reason: type };
    default:
      return { kind: "ignore" };
  }
}

// ---------------------------------------------------------------------------
// Cal.com
// ---------------------------------------------------------------------------

export type CalEvent =
  | { kind: "booking_created"; eventId: string; lead: Lead }
  | { kind: "booking_changed"; eventId: string; trigger: string }
  | { kind: "ping" }
  | { kind: "ignore" };

function response(responses: Obj | null, key: string): string {
  const entry = responses?.[key];
  const value = obj(entry) ? (entry as Obj).value : entry;
  return str(value);
}

/**
 * BOOKING_CREATED becomes a lead (the person booked through the public Cal.com
 * link, so they never filled in a site form). Reschedules and cancellations
 * are recorded but change nothing: Cal.com bookings have no row of their own.
 */
export function calEvent(payload: unknown, receivedAt = new Date().toISOString()): CalEvent {
  const root = obj(payload);
  const trigger = str(root?.triggerEvent, 100).toUpperCase();
  if (trigger === "PING") return { kind: "ping" };

  const body = obj(root?.payload);
  const uid = str(body?.uid, 200);
  if (!trigger || !body || !uid) return { kind: "ignore" };

  if (trigger === "BOOKING_RESCHEDULED" || trigger === "BOOKING_CANCELLED") {
    // A booking can be rescheduled repeatedly; the new start time keeps each
    // occurrence distinct while still collapsing retries of the same delivery.
    return { kind: "booking_changed", trigger, eventId: `${trigger}:${uid}:${str(body.startTime, 50)}` };
  }
  if (trigger !== "BOOKING_CREATED") return { kind: "ignore" };

  const attendee = obj(Array.isArray(body.attendees) ? body.attendees[0] : null);
  const responses = obj(body.responses);
  const email = (str(attendee?.email, 254) || response(responses, "email")).toLowerCase();
  if (!isEmail(email)) return { kind: "ignore" };

  const name = str(attendee?.name, 200) || response(responses, "name") || email;
  const title = str(body.title, 200);
  const start = str(body.startTime, 50);
  const notes = str(body.additionalNotes, 2000) || response(responses, "notes");

  return {
    kind: "booking_created",
    eventId: `BOOKING_CREATED:${uid}`,
    lead: {
      name,
      company: response(responses, "company"),
      email,
      phone: response(responses, "attendeePhoneNumber") || response(responses, "phone"),
      website: "",
      industry: "",
      problem: notes,
      improve: "",
      bestTime: start ? `Booked: ${title || "call"} at ${start}` : undefined,
      submittedAt: receivedAt,
      source: "cal_com_booking",
      status: "submitted",
    },
  };
}
