import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { listWebhookEvents } from "@/lib/apiv1/resources/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "any",
  scopes: ["webhooks:manage"],
  meta: { operationId: "listWebhookEvents", summary: "List subscribable events", tag: "Webhooks", response: z.any() },
}, listWebhookEvents);

export const OPTIONS = options;
