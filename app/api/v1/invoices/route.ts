import { InvoiceSchema, listEnvelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { invoicesQuery, listInvoices } from "@/lib/apiv1/resources/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["billing:read"],
  query: invoicesQuery,
  meta: { operationId: "listInvoices", summary: "List invoices", tag: "Billing", response: listEnvelope(InvoiceSchema) },
}, listInvoices);

export const OPTIONS = options;
