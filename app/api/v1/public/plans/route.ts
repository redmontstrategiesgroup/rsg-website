import { z } from "zod";
import { PlanSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { listPlansHandler } from "@/lib/apiv1/resources/public-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "none",
  rateLimit: { limit: 120, windowMs: 600_000 },
  meta: { operationId: "listPlans", summary: "List active managed service plans", tag: "Public Catalog", response: envelope(z.array(PlanSchema)) },
}, listPlansHandler);

export const OPTIONS = options;
