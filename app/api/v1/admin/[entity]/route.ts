import { z } from "zod";
import { EntitySchema, envelope, listEnvelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { createEntity, entityQuery, listEntities } from "@/lib/apiv1/resources/admin-entities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "admin",
  scopes: ["dashboard:read"],
  query: entityQuery,
  meta: { operationId: "listEntities", summary: "List dashboard entity records", tag: "Admin Entities", response: listEnvelope(EntitySchema) },
}, listEntities);

export const POST = api("POST", {
  auth: "admin",
  scopes: ["dashboard:write"],
  idempotent: true,
  // The create schema is per-entity (chosen from ENTITY_CREATE[entity] inside the handler,
  // since the pipeline resolves `body` before path params are known to the handler), so the
  // route only checks the body is a JSON object; createEntity() does the real validation.
  body: z.record(z.string(), z.unknown()),
  meta: { operationId: "createEntity", summary: "Create a dashboard entity record", tag: "Admin Entities", response: envelope(EntitySchema), status: 201 },
}, createEntity);

export const OPTIONS = options;
