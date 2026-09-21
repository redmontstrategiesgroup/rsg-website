import { BriefSchema, envelope, listEnvelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { createBody, createBriefHandler, listBriefs, listQuery } from "@/lib/apiv1/resources/briefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["briefs:read"],
  query: listQuery,
  meta: { operationId: "listBriefs", summary: "List briefs", tag: "Briefs", response: listEnvelope(BriefSchema) },
}, listBriefs);

export const POST = api("POST", {
  auth: "client",
  scopes: ["briefs:write"],
  idempotent: true,
  body: createBody,
  meta: { operationId: "createBrief", summary: "Create a brief", tag: "Briefs", response: envelope(BriefSchema) },
}, createBriefHandler);

export const OPTIONS = options;
