import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { getClient } from "@/lib/apiv1/resources/admin-clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "admin",
  scopes: ["clients:read"],
  meta: { operationId: "getClient", summary: "Get a client", tag: "Admin Clients", response: z.any() },
}, getClient);

export const OPTIONS = options;
