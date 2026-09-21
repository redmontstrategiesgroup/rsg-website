import { WebhookSecretSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { rotateWebhookSecret } from "@/lib/apiv1/resources/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api("POST", {
  auth: "any",
  scopes: ["webhooks:manage"],
  idempotent: true,
  meta: { operationId: "rotateWebhookSecret", summary: "Rotate the signing secret", tag: "Webhooks", response: envelope(WebhookSecretSchema) },
}, rotateWebhookSecret);

export const OPTIONS = options;
