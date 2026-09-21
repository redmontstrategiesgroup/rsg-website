import { ClientAdminSchema, listEnvelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { clientsQuery, listClients } from "@/lib/apiv1/resources/admin-clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "admin",
  scopes: ["clients:read"],
  query: clientsQuery,
  meta: { operationId: "listClients", summary: "List clients", tag: "Admin Clients", response: listEnvelope(ClientAdminSchema) },
}, listClients);

export const OPTIONS = options;
