import { WebhookDeliverySchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { replayWebhookDelivery } from "@/lib/apiv1/resources/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api("POST", {
  auth: "any",
  scopes: ["webhooks:manage"],
  idempotent: true,
  meta: { operationId: "replayWebhookDelivery", summary: "Replay a failed delivery", tag: "Webhooks", response: envelope(WebhookDeliverySchema) },
}, replayWebhookDelivery);

export const OPTIONS = options;
