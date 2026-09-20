import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { createBody, createWebhook, listWebhooks } from "@/lib/apiv1/resources/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "any",
  scopes: ["webhooks:manage"],
  meta: { operationId: "listWebhooks", summary: "List webhook endpoints", tag: "Webhooks", response: z.any() },
}, listWebhooks);

export const POST = api("POST", {
  auth: "any",
  scopes: ["webhooks:manage"],
  idempotent: true,
  body: createBody,
  meta: { operationId: "createWebhook", summary: "Create a webhook endpoint", tag: "Webhooks", response: z.any() },
}, createWebhook);

export const OPTIONS = options;
