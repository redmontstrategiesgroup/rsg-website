import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { getInvoiceHandler } from "@/lib/apiv1/resources/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["billing:read"],
  meta: { operationId: "getInvoice", summary: "Get an invoice", tag: "Billing", response: z.any() },
}, getInvoiceHandler);

export const OPTIONS = options;
