import { TicketDetailSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { getTicketHandler } from "@/lib/apiv1/resources/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["tickets:read"],
  meta: { operationId: "getTicket", summary: "Get a ticket", tag: "Tickets", response: envelope(TicketDetailSchema) },
}, getTicketHandler);

export const OPTIONS = options;
