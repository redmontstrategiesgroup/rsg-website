import { ProjectDetailSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { getProject } from "@/lib/apiv1/resources/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["projects:read"],
  meta: { operationId: "getProject", summary: "Get a project", tag: "Projects", response: envelope(ProjectDetailSchema) },
}, getProject);
export const OPTIONS = options;
