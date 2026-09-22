import { z } from "zod";
import { EntitySchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { getEntity, patchEntity } from "@/lib/apiv1/resources/admin-entities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "admin",
  scopes: ["dashboard:read"],
  meta: { operationId: "getEntity", summary: "Get a dashboard entity record", tag: "Admin Entities", response: envelope(EntitySchema) },
}, getEntity);

export const PATCH = api("PATCH", {
  auth: "admin",
  scopes: ["dashboard:write"],
  // Per-entity patch schema, same reasoning as the create route: validated inside patchEntity().
  body: z.record(z.string(), z.unknown()),
  meta: { operationId: "updateEntity", summary: "Update a dashboard entity record", tag: "Admin Entities", response: envelope(EntitySchema) },
}, patchEntity);

export const OPTIONS = options;
