import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { auditQuery, listAudit } from "@/lib/apiv1/resources/admin-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "admin",
  scopes: ["audit:read"],
  query: auditQuery,
  meta: { operationId: "listAuditEvents", summary: "List audit events", tag: "Admin Audit", response: z.any() },
}, listAudit);

export const OPTIONS = options;
