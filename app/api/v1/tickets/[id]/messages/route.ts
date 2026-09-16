import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { addTicketMessage, messageBody } from "@/lib/apiv1/resources/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api("POST", {
  auth: "client",
  scopes: ["tickets:write"],
  idempotent: true,
  body: messageBody,
  meta: { operationId: "addTicketMessage", summary: "Add a ticket message", tag: "Tickets", response: z.any() },
}, addTicketMessage);

export const OPTIONS = options;
