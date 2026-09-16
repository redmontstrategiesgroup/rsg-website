import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { listProjects, listQuery } from "@/lib/apiv1/resources/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["projects:read"],
  query: listQuery,
  meta: { operationId: "listProjects", summary: "List projects", tag: "Projects", response: z.any() },
}, listProjects);
export const OPTIONS = options;
