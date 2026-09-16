import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { decideApprovalHandler, decideBody } from "@/lib/apiv1/resources/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api("POST", {
  auth: "client",
  scopes: ["projects:write"],
  idempotent: true,
  body: decideBody,
  meta: { operationId: "decideApproval", summary: "Decide an approval", tag: "Approvals", response: z.any() },
}, decideApprovalHandler);
export const OPTIONS = options;
