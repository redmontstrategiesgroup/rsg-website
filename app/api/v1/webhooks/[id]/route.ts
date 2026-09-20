import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { deleteWebhook, getWebhook, patchBody, patchWebhook } from "@/lib/apiv1/resources/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "any",
  scopes: ["webhooks:manage"],
  meta: { operationId: "getWebhook", summary: "Get a webhook endpoint", tag: "Webhooks", response: z.any() },
}, getWebhook);

export const PATCH = api("PATCH", {
  auth: "any",
  scopes: ["webhooks:manage"],
  body: patchBody,
  meta: { operationId: "updateWebhook", summary: "Update a webhook endpoint", tag: "Webhooks", response: z.any() },
}, patchWebhook);

export const DELETE = api("DELETE", {
  auth: "any",
  scopes: ["webhooks:manage"],
  meta: { operationId: "deleteWebhook", summary: "Delete a webhook endpoint", tag: "Webhooks", response: z.any() },
}, deleteWebhook);

export const OPTIONS = options;
