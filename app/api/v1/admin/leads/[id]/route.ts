import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { deleteLead, getLead, patchBody, patchLead } from "@/lib/apiv1/resources/admin-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "admin",
  scopes: ["leads:read"],
  meta: { operationId: "getLead", summary: "Get a lead", tag: "Admin Leads", response: z.any() },
}, getLead);

export const PATCH = api("PATCH", {
  auth: "admin",
  scopes: ["leads:write"],
  body: patchBody,
  meta: { operationId: "updateLead", summary: "Update a lead", tag: "Admin Leads", response: z.any() },
}, patchLead);

export const DELETE = api("DELETE", {
  auth: "admin",
  scopes: ["leads:write"],
  meta: { operationId: "deleteLead", summary: "Delete a lead", tag: "Admin Leads", response: z.any() },
}, deleteLead);

export const OPTIONS = options;
