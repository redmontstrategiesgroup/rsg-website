import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { getProject } from "@/lib/apiv1/resources/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["projects:read"],
  meta: { operationId: "getProject", summary: "Get a project", tag: "Projects", response: z.any() },
}, getProject);
export const OPTIONS = options;
