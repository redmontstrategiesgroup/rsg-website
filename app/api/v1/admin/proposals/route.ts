import { ProposalSchema, listEnvelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { listProposals, proposalsQuery } from "@/lib/apiv1/resources/admin-proposals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "admin",
  scopes: ["proposals:read"],
  query: proposalsQuery,
  meta: { operationId: "listProposals", summary: "List proposals", tag: "Admin Proposals", response: listEnvelope(ProposalSchema) },
}, listProposals);

export const OPTIONS = options;
