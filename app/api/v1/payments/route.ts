import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { listPayments, pageQuery } from "@/lib/apiv1/resources/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["billing:read"],
  query: pageQuery,
  meta: { operationId: "listPayments", summary: "List payments", tag: "Billing", response: z.any() },
}, listPayments);

export const OPTIONS = options;
