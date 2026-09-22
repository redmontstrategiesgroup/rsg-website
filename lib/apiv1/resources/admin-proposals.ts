// lib/apiv1/resources/admin-proposals.ts
import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import { listProposalsPage } from "@/lib/lifecycle/paged-admin";
import { getProposal } from "@/lib/lifecycle/proposals";
import { adminOf } from "../admin.ts";
import { notFound } from "../errors.ts";
import { parseListParams } from "../pagination.ts";
import { requireUuid } from "../ownership.ts";
import { toProposalDto } from "../serializers-admin.ts";
import type { ApiHandler } from "../types.ts";

export const PROPOSAL_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "revision_requested",
  "approved",
  "expired",
  "withdrawn",
] as const;

export const proposalsQuery = z.object({
  status: z.enum(PROPOSAL_STATUSES).optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

export const listProposals: ApiHandler<undefined, z.infer<typeof proposalsQuery>> = async ({ principal, query, request }) => {
  adminOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listProposalsPage(requireSupabase(), {
    limit,
    cursor,
    status: query.status,
  });
  return { data: page.data.map(toProposalDto), meta: { next_cursor: page.next_cursor, limit } };
};

export const getProposalHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  adminOf(principal);
  const loaded = await getProposal(requireUuid(params.id));
  if (!loaded) throw notFound();
  return { data: toProposalDto(loaded.proposal) };
};
