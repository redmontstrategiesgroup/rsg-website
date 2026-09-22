import { MilestoneSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { requestChangesHandler, changesBody } from "@/lib/apiv1/resources/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api("POST", {
  auth: "client",
  scopes: ["projects:write"],
  idempotent: true,
  body: changesBody,
  meta: { operationId: "requestMilestoneChanges", summary: "Request changes on a milestone", tag: "Projects", response: envelope(MilestoneSchema) },
}, requestChangesHandler);
export const OPTIONS = options;
