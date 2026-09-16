import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { confirmCloseHandler } from "@/lib/apiv1/resources/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api("POST", {
  auth: "client",
  scopes: ["tickets:write"],
  idempotent: true,
  meta: { operationId: "confirmTicketClosure", summary: "Confirm ticket closure", tag: "Tickets", response: z.any() },
}, confirmCloseHandler);

export const OPTIONS = options;
