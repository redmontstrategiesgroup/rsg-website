import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { getProposalHandler } from "@/lib/apiv1/resources/admin-proposals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "admin",
  scopes: ["proposals:read"],
  meta: { operationId: "getProposal", summary: "Get a proposal", tag: "Admin Proposals", response: z.any() },
}, getProposalHandler);

export const OPTIONS = options;
