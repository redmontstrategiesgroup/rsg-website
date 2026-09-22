import { StatusSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { getStatus } from "@/lib/apiv1/resources/public-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "none",
  meta: { operationId: "getStatus", summary: "API health and dependency status", tag: "Public Catalog", response: envelope(StatusSchema), extraResponses: { "503": "Database unreachable — same body, status is degraded" } },
}, getStatus);

export const OPTIONS = options;
