// lib/apiv1/resources/briefs.ts
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { requireSupabase } from "@/lib/lifecycle/core";
import { BriefPayloadSchema } from "@/lib/briefs/schema";
import { ingestBrief } from "@/lib/briefs/ingest";
import { listBriefsPage } from "@/lib/lifecycle/paged";
import { clientOf } from "../client.ts";
import { ApiError, notFound } from "../errors.ts";
import { parseListParams } from "../pagination.ts";
import { requireUuid } from "../ownership.ts";
import { toBriefDto, type BriefRow } from "../serializers.ts";
import type { ApiHandler } from "../types.ts";

export const listQuery = z.object({ limit: z.string().optional(), cursor: z.string().optional() });
export const createBody = BriefPayloadSchema;

export const listBriefs: ApiHandler<undefined, z.infer<typeof listQuery>> = async ({ principal, request }) => {
  const c = clientOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listBriefsPage(requireSupabase(), c.portal.client.id, { limit, cursor });
  return { data: page.data.map(toBriefDto), meta: { next_cursor: page.next_cursor, limit } };
};

export const getBriefHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const id = requireUuid(params.id);
  const { data } = await requireSupabase()
    .from("briefs")
    .select("*")
    .eq("id", id)
    .eq("client_id", c.portal.client.id)
    .maybeSingle();
  if (!data) throw notFound();
  return { data: toBriefDto(data as BriefRow) };
};

export const createBriefHandler: ApiHandler<z.infer<typeof createBody>, undefined> = async ({ principal, body, request }) => {
  const c = clientOf(principal);
  const db = getSupabase();
  if (!db) throw new ApiError(503, "unavailable", "Brief storage is not configured.");
  // The pipeline already required Idempotency-Key; reuse it for the ingest RPC's own dedupe.
  const idem = request.headers.get("idempotency-key")!.trim();
  const result = await ingestBrief(body, `client:${c.portal.client.id}:${idem}`, "api", c.portal.client.id);
  if (!result.duplicate) {
    const { error } = await db.from("briefs").update({ client_id: c.portal.client.id }).eq("id", result.briefId);
    if (error) {
      console.error("[apiv1] brief attribution failed:", error.message);
      throw new ApiError(500, "internal", "Something went wrong.");
    }
  }
  const { data } = await db
    .from("briefs")
    .select("*")
    .eq("id", result.briefId)
    .eq("client_id", c.portal.client.id)
    .maybeSingle();
  if (!data) throw notFound();
  return { data: toBriefDto(data as BriefRow), status: result.duplicate ? 200 : 201 };
};
