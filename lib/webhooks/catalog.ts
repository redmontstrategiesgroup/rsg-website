/**
 * Every outbound event the site emits, in one place.
 *
 * This is the contract subscribers (n8n, Zapier, Slack) build against: the
 * type string, when it fires, and the fields in `data`. docs/webhooks.md is
 * the human copy of this table and a test keeps the two in step, so an event
 * cannot ship undocumented.
 *
 * `slack: true` marks the events posted to Slack by default (a Slack endpoint
 * whose `events` list is empty). They are the ones a person should see as they
 * happen; the rest are for automation.
 */

export type EventSpec = {
  group: string;
  description: string;
  fields: readonly string[];
  slack?: boolean;
};

export const EVENT_CATALOG = {
  // ------------------------------------------------------------- Leads
  "lead.created": {
    group: "Leads",
    description: "A lead was stored from any source (contact form, chat, assessment, demo request, connect, private AI, qualification, Cal.com).",
    fields: ["leadId", "name", "email", "phone", "company", "source", "score", "status", "message"],
    slack: true,
  },
  "lead.status_changed": {
    group: "Leads",
    description: "An admin changed a lead's pipeline status.",
    fields: ["leadId", "name", "email", "status"],
  },
  "lead.analyzed": {
    group: "Leads",
    description: "Claude finished scoring a lead and drafting a first reply.",
    fields: ["leadId", "insightId"],
  },
  "lead.hot": {
    group: "Leads",
    description: "Claude's analysis raised a lead into the hot band.",
    fields: ["leadId", "name", "email", "company", "scoreBefore", "scoreAfter", "rationale"],
    slack: true,
  },
  "lead.reply_sent": {
    group: "Leads",
    description: "The drafted first reply was sent to the lead.",
    fields: ["leadId", "insightId", "subject"],
  },
  "lead.submitted": {
    group: "Leads",
    description: "Qualification flow: a visitor submitted the qualifier.",
    fields: ["leadId", "outcome"],
  },
  "lead.qualified": {
    group: "Leads",
    description: "Qualification flow: the visitor qualified for a booking.",
    fields: ["leadId", "score"],
  },
  "lead.disqualified": {
    group: "Leads",
    description: "Qualification flow: the visitor did not qualify.",
    fields: ["leadId", "score"],
  },
  "lead.manual_review": {
    group: "Leads",
    description: "Qualification flow: the answers need a human decision.",
    fields: ["leadId", "score"],
  },
  "lead.qualified_abandoned": {
    group: "Leads",
    description: "A qualified visitor did not finish booking.",
    fields: ["sessionId", "leadId"],
  },

  // ------------------------------------------------------------- Bookings
  "booking.created": {
    group: "Bookings",
    description: "A call was booked through the site's own scheduler.",
    fields: ["bookingId", "leadId", "startsAt"],
    slack: true,
  },
  "booking.rescheduled": {
    group: "Bookings",
    description: "A site booking moved to a new time.",
    fields: ["bookingId", "startsAt"],
    slack: true,
  },
  "booking.cancelled": {
    group: "Bookings",
    description: "A site booking was cancelled.",
    fields: ["bookingId"],
    slack: true,
  },
  "reminder.due": {
    group: "Bookings",
    description: "A booking reminder came due.",
    fields: ["bookingId", "templateKey"],
  },
  "cal.booking_created": {
    group: "Bookings",
    description: "A call was booked on the public Cal.com page (also creates a lead).",
    fields: ["bookingUid", "leadId", "name", "email", "title", "startsAt"],
    slack: true,
  },
  "cal.booking_rescheduled": {
    group: "Bookings",
    description: "A Cal.com booking moved.",
    fields: ["bookingUid", "startsAt"],
  },
  "cal.booking_cancelled": {
    group: "Bookings",
    description: "A Cal.com booking was cancelled.",
    fields: ["bookingUid", "startsAt"],
    slack: true,
  },

  // ------------------------------------------------------------- Sales pipeline
  "assessment.submitted": {
    group: "Sales pipeline",
    description: "A prospect completed the assessment.",
    fields: ["assessmentId", "leadId", "serviceCategory"],
  },
  "questionnaire.submitted": {
    group: "Sales pipeline",
    description: "A prospect completed the pre-call questionnaire.",
    fields: ["questionnaireId", "bookingId", "leadId", "name", "businessName"],
  },
  "proposal.sent": {
    group: "Sales pipeline",
    description: "A proposal was sent to a prospect.",
    fields: ["proposalId", "opportunityId", "title", "totalCents", "email", "name"],
  },
  "proposal.approved": {
    group: "Sales pipeline",
    description: "The prospect approved a proposal.",
    fields: ["proposalId", "opportunityId", "title", "totalCents", "approvedBy"],
    slack: true,
  },
  "contract.sent": {
    group: "Sales pipeline",
    description: "A contract was sent for signature.",
    fields: ["contractId", "opportunityId", "title", "version", "email", "name"],
  },
  "contract.signed": {
    group: "Sales pipeline",
    description: "A contract was fully executed.",
    fields: ["contractId", "opportunityId", "title", "signerEmail", "signerName"],
    slack: true,
  },

  // ------------------------------------------------------------- Billing
  "invoice.paid": {
    group: "Billing",
    description: "An invoice was paid in Stripe: project invoices (deposits, milestones) and managed-services subscription invoices (subscriptionId set).",
    fields: ["invoiceId", "clientId", "subscriptionId", "amountCents", "currency", "payerEmail"],
    slack: true,
  },
  "payment.failed": {
    group: "Billing",
    description: "A payment attempt failed in Stripe (project invoice or subscription charge).",
    fields: ["invoiceId", "clientId", "subscriptionId", "amountCents", "payerEmail", "reason"],
    slack: true,
  },
  "subscription.changed": {
    group: "Billing",
    description: "A managed-services subscription changed status in Stripe (including scheduled cancellation).",
    fields: ["subscriptionId", "clientId", "plan", "status", "cancelAtPeriodEnd"],
  },
  "subscription.ended": {
    group: "Billing",
    description: "A managed-services subscription ended.",
    fields: ["subscriptionId", "clientId", "plan", "endedAt"],
    slack: true,
  },

  // ------------------------------------------------------------- Client delivery
  "milestone.status_changed": {
    group: "Client delivery",
    description: "A project milestone changed status.",
    fields: ["milestoneId", "projectName", "clientId", "status", "previousStatus"],
  },
  "ticket.created": {
    group: "Client delivery",
    description: "A client opened a support ticket.",
    fields: ["ticketId", "number", "clientId", "subject", "priority"],
    slack: true,
  },
  "ticket.resolved": {
    group: "Client delivery",
    description: "A support ticket was resolved.",
    fields: ["ticketId", "number", "clientId", "subject"],
  },
  "report.published": {
    group: "Client delivery",
    description: "A monthly client report was published.",
    fields: ["reportId", "clientId", "period"],
  },

  // ------------------------------------------------------------- Recordings
  "recording.synced": {
    group: "Recordings",
    description: "A Pocket recording was imported or updated.",
    fields: ["pocketId", "result"],
  },

  // ------------------------------------------------------------- Email list
  "subscriber.added": {
    group: "Email list",
    description: "Someone joined the mailing list.",
    fields: ["email", "source"],
  },
  "subscriber.suppressed": {
    group: "Email list",
    description: "An address was suppressed: unsubscribe link, hard bounce, spam complaint, or Resend suppression.",
    fields: ["email", "reason"],
  },

  // ------------------------------------------------------------- Phone (Twilio)
  "sms.received": {
    group: "Phone (Twilio)",
    description: "A text message arrived on the business number.",
    fields: ["messageSid", "from", "to", "body"],
    slack: true,
  },
  "sms.opted_out": {
    group: "Phone (Twilio)",
    description: "A texter replied STOP (or opted back in with START).",
    fields: ["from", "optOutType"],
  },
  "call.received": {
    group: "Phone (Twilio)",
    description: "A call came in to the business number.",
    fields: ["callSid", "from", "to"],
  },
  "call.missed": {
    group: "Phone (Twilio)",
    description: "A forwarded call was not answered.",
    fields: ["callSid", "from", "dialStatus"],
    slack: true,
  },
  "voicemail.received": {
    group: "Phone (Twilio)",
    description: "A caller left a voicemail.",
    fields: ["callSid", "recordingSid", "from", "recordingUrl", "durationSeconds"],
    slack: true,
  },
} as const satisfies Record<string, EventSpec>;

export type EventType = keyof typeof EVENT_CATALOG;

export const EVENT_TYPES = Object.keys(EVENT_CATALOG) as EventType[];

/** Events a Slack endpoint receives when its `events` list is empty. */
export const SLACK_DEFAULT_EVENTS: readonly EventType[] = EVENT_TYPES.filter(
  (t) => (EVENT_CATALOG[t] as EventSpec).slack === true,
);

export function isEventType(value: string): value is EventType {
  return Object.prototype.hasOwnProperty.call(EVENT_CATALOG, value);
}
