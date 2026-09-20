import { z, type ZodType } from "zod";

/**
 * Outbound webhook event catalog — the single source of truth for which
 * events exist, who may subscribe to them, and (for the OpenAPI spec) what
 * their `data` looks like.
 *
 * Audience: `client` endpoints only receive events about their own client;
 * `admin` endpoints receive everything. `both` means the event is a client
 * event that admin endpoints also see (with `client_id` in the payload).
 */

export const EVENT_TYPES = [
  "project.updated",
  "milestone.completed",
  "milestone.approved",
  "milestone.changes_requested",
  "task.completed",
  "approval.requested",
  "approval.decided",
  "ticket.created",
  "ticket.replied",
  "ticket.resolved",
  "brief.received",
  "file.uploaded",
  "invoice.created",
  "invoice.paid",
  "lead.created",
  "lead.updated",
  "booking.created",
  "booking.cancelled",
  "client.activated",
  "proposal.accepted",
  "proposal.declined",
  "ping",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type Audience = "client" | "admin" | "both";

export type EventDefinition = {
  audience: Audience;
  description: string;
  dataSchema: ZodType;
};

// Phase 3 ships loose data schemas; Phase 4 tightens them from the DTO shapes.
const loose = () => z.object({}).passthrough();

export const EVENTS: Record<EventType, EventDefinition> = {
  "project.updated": { audience: "both", description: "A project's status, phase or dates changed.", dataSchema: loose() },
  "milestone.completed": { audience: "both", description: "A milestone was marked completed by the RSG team.", dataSchema: loose() },
  "milestone.approved": { audience: "both", description: "The client approved a milestone that was under review.", dataSchema: loose() },
  "milestone.changes_requested": { audience: "both", description: "The client requested changes on a milestone under review.", dataSchema: loose() },
  "task.completed": { audience: "both", description: "A client-assigned task was completed.", dataSchema: loose() },
  "approval.requested": { audience: "both", description: "The RSG team asked the client to approve something.", dataSchema: loose() },
  "approval.decided": { audience: "both", description: "The client approved or requested changes on an approval.", dataSchema: loose() },
  "ticket.created": { audience: "both", description: "A support ticket was opened.", dataSchema: loose() },
  "ticket.replied": { audience: "both", description: "A non-internal message was added to a ticket.", dataSchema: loose() },
  "ticket.resolved": { audience: "both", description: "A support ticket was resolved.", dataSchema: loose() },
  "brief.received": { audience: "both", description: "A brief was ingested for the client.", dataSchema: loose() },
  "file.uploaded": { audience: "both", description: "A file was added to the client's workspace.", dataSchema: loose() },
  "invoice.created": { audience: "both", description: "An invoice was issued to the client.", dataSchema: loose() },
  "invoice.paid": { audience: "both", description: "An invoice was paid in full.", dataSchema: loose() },
  "lead.created": { audience: "admin", description: "A new lead was captured.", dataSchema: loose() },
  "lead.updated": { audience: "admin", description: "A lead's status, owner or notes changed.", dataSchema: loose() },
  "booking.created": { audience: "admin", description: "A consultation was booked.", dataSchema: loose() },
  "booking.cancelled": { audience: "admin", description: "A consultation was cancelled.", dataSchema: loose() },
  "client.activated": { audience: "admin", description: "A client account was provisioned from an opportunity.", dataSchema: loose() },
  "proposal.accepted": { audience: "admin", description: "A proposal was approved by the prospect.", dataSchema: loose() },
  "proposal.declined": { audience: "admin", description: "A prospect requested a revision to a proposal.", dataSchema: loose() },
  ping: {
    audience: "both",
    description: "Test event sent on demand from the endpoint's Test action.",
    dataSchema: z.object({ endpoint_id: z.string().uuid(), sent_at: z.iso.datetime() }),
  },
};

export function isEventType(s: string): s is EventType {
  return (EVENT_TYPES as readonly string[]).includes(s);
}

export function visibleTo(type: EventType, ownerType: "client" | "admin"): boolean {
  const audience = EVENTS[type].audience;
  if (ownerType === "admin") return true;
  return audience === "client" || audience === "both";
}

export function eventsFor(audience: "client" | "admin"): EventType[] {
  return EVENT_TYPES.filter((t) => visibleTo(t, audience));
}
