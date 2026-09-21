import { CsvSchema } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { exportLeads, exportQuery } from "@/lib/apiv1/resources/admin-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "admin",
  scopes: ["leads:read"],
  query: exportQuery,
  rateLimit: { limit: 10, windowMs: 600_000 },
  meta: { operationId: "exportLeads", summary: "Export leads as CSV", tag: "Admin Leads", response: CsvSchema, contentType: "text/csv" },
}, exportLeads);

export const OPTIONS = options;
