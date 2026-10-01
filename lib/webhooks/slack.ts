import { EVENT_CATALOG, isEventType, type EventSpec } from "./catalog.ts";

/**
 * Format an outbound event as a Slack incoming-webhook message. Pure, so the
 * outbox can call it per delivery and tests can pin the output.
 *
 * Slack treats &, < and > as control characters in mrkdwn; every value from
 * an event (a lead's name, an SMS body) is escaped so a visitor cannot inject
 * links or @channel mentions into the workspace.
 */

const TITLES: Partial<Record<string, string>> = {
  "lead.created": "New lead",
  "lead.hot": "Lead upgraded to hot",
  "booking.created": "Call booked",
  "booking.rescheduled": "Booking rescheduled",
  "booking.cancelled": "Booking cancelled",
  "cal.booking_created": "Call booked on Cal.com",
  "cal.booking_cancelled": "Cal.com booking cancelled",
  "proposal.approved": "Proposal approved",
  "contract.signed": "Contract signed",
  "invoice.paid": "Invoice paid",
  "payment.failed": "Payment failed",
  "subscription.ended": "Subscription ended",
  "ticket.created": "New support ticket",
  "sms.received": "Text message received",
  "call.missed": "Missed call",
  "voicemail.received": "New voicemail",
};

const MAX_VALUE = 500;

export function escapeSlack(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function display(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value.slice(0, MAX_VALUE);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value).slice(0, MAX_VALUE);
  } catch {
    return null;
  }
}

function label(field: string): string {
  const spaced = field.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function money(cents: unknown): string | null {
  return typeof cents === "number" && Number.isFinite(cents) ? `$${(cents / 100).toFixed(2)}` : null;
}

export function slackMessage(
  eventType: string,
  data: Record<string, unknown>,
  adminUrl?: string,
): { text: string; blocks: unknown[] } {
  const title = TITLES[eventType] ?? eventType;
  const spec: EventSpec | null = isEventType(eventType) ? EVENT_CATALOG[eventType] : null;
  const fields = spec ? [...spec.fields] : Object.keys(data);

  const lines: string[] = [];
  for (const field of fields) {
    const raw = data[field];
    const value = field.endsWith("Cents") ? money(raw) : display(raw);
    if (value === null) continue;
    lines.push(`*${label(field.replace(/Cents$/, ""))}:* ${escapeSlack(value)}`);
  }

  const blocks: unknown[] = [
    { type: "section", text: { type: "mrkdwn", text: `*${escapeSlack(title)}*` } },
  ];
  if (lines.length) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: lines.join("\n").slice(0, 2900) } });
  }
  if (adminUrl) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `<${adminUrl}|Open admin console> · \`${escapeSlack(eventType)}\`` }],
    });
  }

  // `text` is the notification/fallback line; keep it short and plain.
  const who = display(data.name) ?? display(data.from) ?? display(data.email);
  const text = escapeSlack(who ? `${title}: ${who}` : title);
  return { text, blocks };
}
