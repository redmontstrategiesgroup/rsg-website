import { QueuedSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { testWebhook } from "@/lib/apiv1/resources/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api("POST", {
  auth: "any",
  scopes: ["webhooks:manage"],
  idempotent: true,
  meta: { operationId: "testWebhook", summary: "Send a ping to the endpoint", tag: "Webhooks", response: envelope(QueuedSchema), status: 202 },
}, testWebhook);

export const OPTIONS = options;
