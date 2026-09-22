// lib/apiv1/resources/admin-analytics.ts
import { z } from "zod";
import { getPageViews } from "@/lib/store";
import { adminOf } from "../admin.ts";
import { encodeCursor, parseListParams } from "../pagination.ts";
import { toPageViewDto } from "../serializers-admin.ts";
import type { ApiHandler } from "../types.ts";

export const pageviewsQuery = z.object({
  since: z.iso.datetime().optional(),
  until: z.iso.datetime().optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

// Page views have no `id`, so the keyset cursor's id component is this
// fixed, valid-v4-shaped UUID placeholder rather than a real row id.
// Consequence: two page views with the exact same `at` timestamp straddling
// a page boundary cannot both be represented in the cursor — anything at
// or after the cursor's `createdAt` is simply excluded from the next page,
// so a same-timestamp tie can be silently dropped. Acceptable for this
// low-volume, best-effort analytics feed.
const CURSOR_ID_PLACEHOLDER = "00000000-0000-4000-8000-000000000000";

export const listPageViews: ApiHandler<undefined, z.infer<typeof pageviewsQuery>> = async ({ principal, query, request }) => {
  adminOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);

  const all = await getPageViews();
  let rows = [...all].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  if (query.since) rows = rows.filter((v) => v.at >= query.since!);
  if (query.until) rows = rows.filter((v) => v.at < query.until!);
  if (cursor) rows = rows.filter((v) => v.at < cursor.createdAt);

  const page = rows.slice(0, limit + 1);
  const hasMore = page.length > limit;
  const data = page.slice(0, limit);
  const last = data[data.length - 1];
  const next_cursor = hasMore && last ? encodeCursor({ createdAt: last.at, id: CURSOR_ID_PLACEHOLDER }) : null;

  return { data: data.map(toPageViewDto), meta: { next_cursor, limit } };
};
