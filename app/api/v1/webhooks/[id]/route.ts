import { DeletedSchema, WebhookEndpointSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { deleteWebhook, getWebhook, patchBody, patchWebhook } from "@/lib/apiv1/resources/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "any",
  scopes: ["webhooks:manage"],
  meta: { operationId: "getWebhook", summary: "Get a webhook endpoint", tag: "Webhooks", response: envelope(WebhookEndpointSchema) },
}, getWebhook);

export const PATCH = api("PATCH", {
  auth: "any",
  scopes: ["webhooks:manage"],
  body: patchBody,
  meta: { operationId: "updateWebhook", summary: "Update a webhook endpoint", tag: "Webhooks", response: envelope(WebhookEndpointSchema) },
}, patchWebhook);

export const DELETE = api("DELETE", {
  auth: "any",
  scopes: ["webhooks:manage"],
  meta: { operationId: "deleteWebhook", summary: "Delete a webhook endpoint", tag: "Webhooks", response: envelope(DeletedSchema) },
}, deleteWebhook);

export const OPTIONS = options;
