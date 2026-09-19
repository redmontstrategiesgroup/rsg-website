import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { createBody, createLead, listLeads, listQuery } from "@/lib/apiv1/resources/admin-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "admin",
  scopes: ["leads:read"],
  query: listQuery,
  meta: { operationId: "listLeads", summary: "List leads", tag: "Admin Leads", response: z.any() },
}, listLeads);

export const POST = api("POST", {
  auth: "admin",
  scopes: ["leads:write"],
  idempotent: true,
  body: createBody,
  meta: { operationId: "createLead", summary: "Create a lead", tag: "Admin Leads", response: z.any() },
}, createLead);

export const OPTIONS = options;
