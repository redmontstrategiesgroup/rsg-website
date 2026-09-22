// lib/apiv1/resources/admin-audit.ts
import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import { listAuditPage } from "@/lib/lifecycle/paged-admin";
import { adminOf } from "../admin.ts";
import { parseListParams } from "../pagination.ts";
import { toAuditEventDto } from "../serializers-admin.ts";
import type { ApiHandler } from "../types.ts";

export const auditQuery = z.object({
  action: z.string().max(120).optional(),
  since: z.iso.datetime().optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

export const listAudit: ApiHandler<undefined, z.infer<typeof auditQuery>> = async ({ principal, query, request }) => {
  adminOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listAuditPage(requireSupabase(), {
    limit,
    cursor,
    action: query.action,
    since: query.since,
  });
  return { data: page.data.map(toAuditEventDto), meta: { next_cursor: page.next_cursor, limit } };
};
