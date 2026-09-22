import { TaskSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { completeTaskHandler } from "@/lib/apiv1/resources/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api("POST", {
  auth: "client",
  scopes: ["projects:write"],
  idempotent: true,
  meta: { operationId: "completeTask", summary: "Complete a client task", tag: "Projects", response: envelope(TaskSchema) },
}, completeTaskHandler);
export const OPTIONS = options;
