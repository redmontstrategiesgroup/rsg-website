import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { deliveriesQuery, listWebhookDeliveries } from "@/lib/apiv1/resources/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "any",
  scopes: ["webhooks:manage"],
  query: deliveriesQuery,
  meta: { operationId: "listWebhookDeliveries", summary: "List recent deliveries", tag: "Webhooks", response: z.any() },
}, listWebhookDeliveries);

export const OPTIONS = options;
