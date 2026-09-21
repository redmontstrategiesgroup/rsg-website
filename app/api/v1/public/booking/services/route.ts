import { ServicesSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { listServices } from "@/lib/apiv1/resources/public-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "none",
  rateLimit: { limit: 120, windowMs: 600_000 },
  meta: { operationId: "listBookingServices", summary: "List active booking services and appointment types", tag: "Public Catalog", response: envelope(ServicesSchema) },
}, listServices);

export const OPTIONS = options;
