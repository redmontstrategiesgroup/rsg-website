import { ClientAdminSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { getClient } from "@/lib/apiv1/resources/admin-clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "admin",
  scopes: ["clients:read"],
  meta: { operationId: "getClient", summary: "Get a client", tag: "Admin Clients", response: envelope(ClientAdminSchema) },
}, getClient);

export const OPTIONS = options;
