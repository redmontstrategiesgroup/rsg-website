import { TicketSchema, envelope, listEnvelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { createBody, createTicketHandler, listQuery, listTickets } from "@/lib/apiv1/resources/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["tickets:read"],
  query: listQuery,
  meta: { operationId: "listTickets", summary: "List tickets", tag: "Tickets", response: listEnvelope(TicketSchema) },
}, listTickets);

export const POST = api("POST", {
  auth: "client",
  scopes: ["tickets:write"],
  idempotent: true,
  body: createBody,
  meta: { operationId: "createTicket", summary: "Create a ticket", tag: "Tickets", response: envelope(TicketSchema) },
}, createTicketHandler);

export const OPTIONS = options;
