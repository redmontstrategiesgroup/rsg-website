// lib/apiv1/resources/admin-leads.ts
import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import { getLeadRow, listLeadsPage, softDeleteLead } from "@/lib/lifecycle/paged-admin";
import { processLead } from "@/lib/leads";
import { updateLead } from "@/lib/store";
import type { Lead } from "@/lib/types";
import { adminOf, auditVia } from "../admin.ts";
import { toCsv } from "../csv.ts";
import { ApiError, notFound } from "../errors.ts";
import { decodeCursor, parseListParams } from "../pagination.ts";
import { requireUuid } from "../ownership.ts";
import { searchTerm } from "../search.ts";
import { toLeadDto } from "../serializers-admin.ts";
import type { ApiHandler } from "../types.ts";

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "meeting_scheduled",
  "won",
  "lost",
  "spam",
  "archived",
] as const;

export const listQuery = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  since: z.iso.datetime().optional(),
  q: z.string().max(80).optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

export const createBody = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email().max(200),
  company: z.string().max(160).default(""),
  phone: z.string().max(40).default(""),
  website: z.string().max(200).default(""),
  industry: z.string().max(80).default(""),
  message: z.string().max(4000).default(""),
  source: z.string().max(60).default("api"),
});

export const patchBody = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    notes: z.string().max(8000).optional(),
    owner: z.string().max(200).optional(),
    archived_at: z.iso.datetime().nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "Empty patch.");

export const LEAD_CSV_COLUMNS = [
  { key: "id", header: "id" },
  { key: "created_at", header: "created_at" },
  { key: "name", header: "name" },
  { key: "business_name", header: "company" },
  { key: "email", header: "email" },
  { key: "phone", header: "phone" },
  { key: "website", header: "website" },
  { key: "industry", header: "industry" },
  { key: "source", header: "source" },
  { key: "status", header: "status" },
  { key: "lead_score", header: "score" },
  { key: "owner", header: "owner" },
  { key: "biggest_problem", header: "problem" },
  { key: "improvement_goal", header: "improve" },
  { key: "utm_source", header: "utm_source" },
  { key: "utm_medium", header: "utm_medium" },
  { key: "utm_campaign", header: "utm_campaign" },
];

export const listLeads: ApiHandler<undefined, z.infer<typeof listQuery>> = async ({ principal, query, request }) => {
  adminOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listLeadsPage(requireSupabase(), {
    limit,
    cursor,
    q: searchTerm(query.q),
    status: query.status,
    since: query.since,
  });
  return { data: page.data.map(toLeadDto), meta: { next_cursor: page.next_cursor, limit } };
};

export const getLead: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  adminOf(principal);
  const row = await getLeadRow(requireSupabase(), requireUuid(params.id));
  if (!row) throw notFound();
  return { data: toLeadDto(row) };
};

export const createLead: ApiHandler<z.infer<typeof createBody>, undefined> = async ({ principal, body }) => {
  const admin = adminOf(principal);
  const lead: Lead = {
    name: body.name,
    company: body.company,
    email: body.email,
    phone: body.phone,
    website: body.website,
    industry: body.industry,
    problem: body.message,
    improve: "",
    submittedAt: new Date().toISOString(),
    source: body.source,
    status: "new",
  };
  const result = await processLead(lead);
  if (!result.storedInDatabase) {
    throw new ApiError(503, "unavailable", "The lead could not be stored.");
  }
  const row = await getLeadRow(requireSupabase(), result.leadId!);
  if (!row) throw new ApiError(503, "unavailable", "The lead could not be read back.");
  await auditVia(admin, { action: "lead.create", entityType: "lead", entityId: row.id });
  return { data: toLeadDto(row), status: result.duplicate ? 200 : 201 };
};

export const patchLead: ApiHandler<z.infer<typeof patchBody>, undefined> = async ({ principal, params, body }) => {
  const admin = adminOf(principal);
  const id = requireUuid(params.id);
  const existing = await getLeadRow(requireSupabase(), id);
  if (!existing) throw notFound();
  await updateLead(id, {
    status: body.status,
    notes: body.notes,
    owner: body.owner,
    archivedAt: body.archived_at,
  });
  await auditVia(admin, { action: "lead.update", entityType: "lead", entityId: id, metadata: { fields: Object.keys(body) } });
  const row = await getLeadRow(requireSupabase(), id);
  return { data: row ? toLeadDto(row) : null };
};

export const deleteLead: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const admin = adminOf(principal);
  const id = requireUuid(params.id);
  const deleted = await softDeleteLead(requireSupabase(), id);
  if (!deleted) throw notFound();
  await auditVia(admin, { action: "lead.delete", entityType: "lead", entityId: id });
  return { data: { id, deleted: true } };
};

export const exportQuery = listQuery.omit({ limit: true, cursor: true });

export const exportLeads: ApiHandler<undefined, z.infer<typeof exportQuery>> = async ({ principal, query }) => {
  adminOf(principal);
  const sb = requireSupabase();
  const q = searchTerm(query.q);
  const all: Parameters<typeof toLeadDto>[0][] = [];
  let cursor = null as ReturnType<typeof decodeCursor>;
  do {
    const page = await listLeadsPage(sb, {
      limit: 1000,
      cursor,
      q,
      status: query.status,
      since: query.since,
    });
    all.push(...page.data);
    cursor = page.next_cursor ? decodeCursor(page.next_cursor) : null;
  } while (cursor && all.length < 10_000);

  const csv = toCsv(all as unknown as Record<string, unknown>[], LEAD_CSV_COLUMNS);
  const date = new Date().toISOString().slice(0, 10);
  return {
    data: null,
    raw: new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
      },
    }),
  };
};
