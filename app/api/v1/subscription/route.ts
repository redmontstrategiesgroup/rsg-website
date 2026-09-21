import { SubscriptionSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { getSubscription } from "@/lib/apiv1/resources/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["billing:read"],
  meta: { operationId: "getSubscription", summary: "Get the active subscription", tag: "Billing", response: envelope(SubscriptionSchema.nullable()) },
}, getSubscription);

export const OPTIONS = options;
