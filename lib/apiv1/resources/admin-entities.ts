// lib/apiv1/resources/admin-entities.ts
import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import { listEntitiesPage } from "@/lib/lifecycle/paged-admin";
import { ENTITY_CREATE, ENTITY_PATCH, isEntityName } from "@/lib/dashboard/entity-schemas";
import { adminOf, auditVia } from "../admin.ts";
import { ApiError, notFound } from "../errors.ts";
import { parseListParams } from "../pagination.ts";
import { requireUuid } from "../ownership.ts";
import { ENTITY_TABLE, toEntityDto, type EntityName, type EntityRow } from "../serializers-admin.ts";
import type { ApiHandler } from "../types.ts";

export const entityQuery = z.object({
  status: z.string().max(40).optional(),
  stage: z.string().max(40).optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

/** `params.entity` comes from the path, so it can't be validated by the pipeline's zod `query`/`body`
 * config the way other admin resources are — it has to be checked in the handler itself. An
 * unrecognised entity is 404, never a 400/422, so callers can't distinguish "wrong id" from
 * "unsupported entity" (same 404-for-unowned-or-missing rationale as requireUuid()). */
function requireEntityName(entity: string | undefined): EntityName {
  if (!entity || !isEntityName(entity)) throw notFound();
  return entity;
}

export const listEntities: ApiHandler<undefined, z.infer<typeof entityQuery>> = async ({ principal, params, query, request }) => {
  adminOf(principal);
  const entity = requireEntityName(params.entity);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listEntitiesPage(requireSupabase(), ENTITY_TABLE[entity], {
    limit,
    cursor,
    status: query.status,
    stage: query.stage,
  });
  return { data: page.data.map((r) => toEntityDto(entity, r)), meta: { next_cursor: page.next_cursor, limit } };
};

export const getEntity: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  adminOf(principal);
  const entity = requireEntityName(params.entity);
  const id = requireUuid(params.id);
  const sb = requireSupabase();
  const { data, error } = await sb.from(ENTITY_TABLE[entity]).select("*").eq("id", id).maybeSingle();
  if (error) throw new ApiError(500, "internal", "The record could not be read.");
  if (!data) throw notFound();
  return { data: toEntityDto(entity, data as EntityRow) };
};

// The pipeline can't pick a per-entity body schema (it depends on the `[entity]` path param
// resolved only once params are known), so the route declares `body: z.record(z.string(),
// z.unknown())` and this handler does the real validation itself against
// ENTITY_CREATE[entity].schema, mirroring the cookie route at
// app/api/dashboard/entities/[entity]/route.ts.
export const createEntity: ApiHandler<Record<string, unknown>, undefined> = async ({ principal, params, body }) => {
  const admin = adminOf(principal);
  const entity = requireEntityName(params.entity);
  const config = ENTITY_CREATE[entity];
  const parsed = config.schema.safeParse(body);
  if (!parsed.success) throw new ApiError(422, "validation_failed", "Invalid record.", parsed.error.flatten());
  const sb = requireSupabase();
  const { data, error } = await sb.from(config.table).insert(parsed.data as never).select("*").single();
  if (error) throw new ApiError(500, "internal", "The record could not be created.");
  const row = data as EntityRow;
  // Mirrors the cookie route's audit behaviour exactly: both an `audit_log` table row (read by
  // the dashboard UI) and a `writeAuditEvent` (read by the v1 audit API), via auditVia().
  await sb.from("audit_log").insert({ actor_identifier: admin.email, action: "create", entity_type: entity, entity_id: row.id });
  await auditVia(admin, { action: "dashboard.create", entityType: entity, entityId: row.id });
  return { data: toEntityDto(entity, row), status: 201 };
};

export const patchEntity: ApiHandler<Record<string, unknown>, undefined> = async ({ principal, params, body }) => {
  const admin = adminOf(principal);
  const entity = requireEntityName(params.entity);
  const id = requireUuid(params.id);
  const config = ENTITY_PATCH[entity];
  const parsed = config.schema.safeParse(body);
  if (!parsed.success) throw new ApiError(422, "validation_failed", "Invalid update.", parsed.error.flatten());
  if (Object.keys(parsed.data).length === 0) throw new ApiError(422, "validation_failed", "Invalid update.");
  const sb = requireSupabase();
  const { data, error } = await sb.from(config.table).update({ ...parsed.data, updated_at: new Date().toISOString() } as never).eq("id", id).select("*").single();
  if (error) throw new ApiError(500, "internal", "The record could not be updated.");
  if (!data) throw notFound();
  const row = data as EntityRow;
  await sb.from("audit_log").insert({ actor_identifier: admin.email, action: "update", entity_type: entity, entity_id: id, details: { fields: Object.keys(parsed.data) } });
  await auditVia(admin, { action: "dashboard.update", entityType: entity, entityId: id, metadata: { fields: Object.keys(parsed.data) } });
  return { data: toEntityDto(entity, row) };
};
