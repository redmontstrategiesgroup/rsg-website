import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { approveMilestoneHandler, noteBody } from "@/lib/apiv1/resources/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api("POST", {
  auth: "client",
  scopes: ["projects:write"],
  idempotent: true,
  body: noteBody,
  meta: { operationId: "approveMilestone", summary: "Approve a milestone", tag: "Projects", response: z.any() },
}, approveMilestoneHandler);
export const OPTIONS = options;
