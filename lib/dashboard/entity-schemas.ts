// lib/dashboard/entity-schemas.ts
//
// Shared zod schemas for the dashboard "entity" tables (actions,
// opportunities, risks, ideas — plus briefs/notifications for patches).
// Extracted verbatim from the cookie routes at
// app/api/dashboard/entities/[entity]/route.ts (create) and
// app/api/dashboard/entities/[entity]/[id]/route.ts (patch) so the v1 admin
// API can reuse the exact same validation without changing either route's
// behaviour. Imported by a plain `node --test` file, so: relative imports
// only (no `@/`), explicit `.ts` extensions, no enums / parameter
// properties / namespaces, no `any`.
import { z } from "zod";
import type { EntityName } from "../apiv1/serializers-admin.ts";

export const ENTITY_CREATE: Record<EntityName, { table: string; schema: z.ZodObject }> = {
  actions: { table: "action_items", schema: z.object({ title: z.string().min(1).max(240), description: z.string().max(20_000).optional(), priority: z.enum(["critical","high","medium","low"]).default("medium"), status: z.enum(["new","reviewing","planned","in_progress","blocked","completed","dismissed"]).default("new"), due_date: z.iso.date().optional(), requires_review: z.boolean().default(false) }) },
  opportunities: { table: "opportunities", schema: z.object({ name: z.string().min(1).max(240), description: z.string().max(20_000).optional(), opportunity_type: z.string().max(100).default("operational_improvement"), stage: z.enum(["discovered","reviewing","validating","approved","building","launched","paused","rejected"]).default("discovered"), horizon: z.enum(["immediate","near_term","long_term","experimental"]).default("near_term"), recommended_next_step: z.string().max(10_000).optional(), requires_review: z.boolean().default(false) }) },
  risks: { table: "risks", schema: z.object({ title: z.string().min(1).max(240), description: z.string().max(20_000).optional(), severity: z.enum(["critical","high","medium","low"]).default("medium"), status: z.enum(["active","monitoring","mitigated","accepted","closed"]).default("monitoring"), mitigation: z.string().max(10_000).optional() }) },
  ideas: { table: "ideas", schema: z.object({ title: z.string().min(1).max(240), description: z.string().max(20_000).optional(), idea_type: z.string().max(100).default("service"), status: z.enum(["captured","reviewing","validated","building","shipped","dismissed"]).default("captured"), next_step: z.string().max(10_000).optional() }) },
};

export const ENTITY_PATCH: Record<EntityName | "briefs" | "notifications", { table: string; schema: z.ZodObject }> = {
  briefs: { table: "briefs", schema: z.object({ is_read: z.boolean().optional(), is_pinned: z.boolean().optional(), is_archived: z.boolean().optional(), status: z.enum(["draft","published","archived"]).optional() }).strict() },
  actions: { table: "action_items", schema: z.object({ status: z.enum(["new","reviewing","planned","in_progress","blocked","completed","dismissed"]).optional(), priority: z.enum(["critical","high","medium","low"]).optional(), due_date: z.iso.date().nullable().optional(), deferred_until: z.iso.date().nullable().optional(), dismissal_reason: z.string().max(2_000).nullable().optional(), requires_review: z.boolean().optional(), approved_at: z.iso.datetime().nullable().optional(), completed_at: z.iso.datetime().nullable().optional() }).strict() },
  opportunities: { table: "opportunities", schema: z.object({ stage: z.enum(["discovered","reviewing","validating","approved","building","launched","paused","rejected"]).optional(), requires_review: z.boolean().optional(), approved_at: z.iso.datetime().nullable().optional() }).strict() },
  risks: { table: "risks", schema: z.object({ status: z.enum(["active","monitoring","mitigated","accepted","closed"]).optional(), last_reviewed_at: z.iso.datetime().nullable().optional() }).strict() },
  ideas: { table: "ideas", schema: z.object({ status: z.enum(["captured","reviewing","validated","building","shipped","dismissed"]).optional() }).strict() },
  notifications: { table: "notifications", schema: z.object({ is_read: z.boolean() }).strict() },
};

const ENTITY_NAMES: readonly EntityName[] = ["actions", "opportunities", "risks", "ideas"];

export function isEntityName(s: string): s is EntityName {
  return (ENTITY_NAMES as readonly string[]).includes(s);
}
