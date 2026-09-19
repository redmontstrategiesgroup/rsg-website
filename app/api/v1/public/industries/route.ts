import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { listIndustries } from "@/lib/apiv1/resources/public-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "none",
  rateLimit: { limit: 120, windowMs: 600_000 },
  meta: { operationId: "listIndustries", summary: "List published industry verticals", tag: "Public Catalog", response: z.any() },
}, listIndustries);

export const OPTIONS = options;
