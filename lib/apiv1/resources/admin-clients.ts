// lib/apiv1/resources/admin-clients.ts
import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import { getClientRow, listClientsPage } from "@/lib/lifecycle/paged-admin";
import { adminOf } from "../admin.ts";
import { notFound } from "../errors.ts";
import { parseListParams } from "../pagination.ts";
import { requireUuid } from "../ownership.ts";
import { searchTerm } from "../search.ts";
import { toClientAdminDto } from "../serializers-admin.ts";
import type { ApiHandler } from "../types.ts";

export const CLIENT_STATUSES = [
  "prospect",
  "onboarding",
  "active",
  "paused",
  "support",
  "former",
] as const;

export const clientsQuery = z.object({
  q: z.string().max(80).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

export const listClients: ApiHandler<undefined, z.infer<typeof clientsQuery>> = async ({ principal, query, request }) => {
  adminOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listClientsPage(requireSupabase(), {
    limit,
    cursor,
    q: searchTerm(query.q),
    status: query.status,
  });
  return { data: page.data.map(toClientAdminDto), meta: { next_cursor: page.next_cursor, limit } };
};

export const getClient: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  adminOf(principal);
  const row = await getClientRow(requireSupabase(), requireUuid(params.id));
  if (!row) throw notFound();
  return { data: toClientAdminDto(row) };
};
