import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { listProposals, proposalsQuery } from "@/lib/apiv1/resources/admin-proposals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "admin",
  scopes: ["proposals:read"],
  query: proposalsQuery,
  meta: { operationId: "listProposals", summary: "List proposals", tag: "Admin Proposals", response: z.any() },
}, listProposals);

export const OPTIONS = options;
