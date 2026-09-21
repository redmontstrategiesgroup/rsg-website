import { MeSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { ApiError } from "@/lib/apiv1/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export const GET = api("GET", {
  auth: "none",
  meta: { operationId: "getMe", summary: "Identify the calling key", tag: "Account", response: envelope(MeSchema) },
}, async ({ principal }) => {
  if (!principal) throw new ApiError(401, "unauthenticated", "Missing API key.");
  const key = { id: principal.keyId, name: principal.keyName, scopes: principal.scopes };
  if (principal.type === "client") {
    const c = principal.portal.client;
    return { data: { principal: "client", key, client: { id: c.id, company: c.company, name: c.name, email: c.email, status: c.status } } };
  }
  return { data: { principal: "admin", key, admin: { id: principal.adminId, email: principal.email, role: principal.role } } };
});

export const OPTIONS = options;
