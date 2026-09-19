import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { listPageViews, pageviewsQuery } from "@/lib/apiv1/resources/admin-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "admin",
  scopes: ["analytics:read"],
  query: pageviewsQuery,
  meta: { operationId: "listPageViews", summary: "List page views", tag: "Admin Analytics", response: z.any() },
}, listPageViews);

export const OPTIONS = options;
