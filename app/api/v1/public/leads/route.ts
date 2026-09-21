import { LeadAcceptedSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { createBody, submitLead } from "@/lib/apiv1/resources/public-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api("POST", {
  auth: "none",
  idempotent: true,
  rateLimit: { limit: 5, windowMs: 3_600_000 },
  body: createBody,
  meta: { operationId: "submitLead", summary: "Submit a lead", tag: "Public Leads", response: envelope(LeadAcceptedSchema), status: 202 },
}, submitLead);

export const OPTIONS = options;
