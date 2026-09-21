import { TicketSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { reopenHandler } from "@/lib/apiv1/resources/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api("POST", {
  auth: "client",
  scopes: ["tickets:write"],
  idempotent: true,
  meta: { operationId: "reopenTicket", summary: "Reopen a ticket", tag: "Tickets", response: envelope(TicketSchema) },
}, reopenHandler);

export const OPTIONS = options;
