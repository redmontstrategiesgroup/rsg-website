import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { getBriefHandler } from "@/lib/apiv1/resources/briefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["briefs:read"],
  meta: { operationId: "getBrief", summary: "Get a brief", tag: "Briefs", response: z.any() },
}, getBriefHandler);

export const OPTIONS = options;
