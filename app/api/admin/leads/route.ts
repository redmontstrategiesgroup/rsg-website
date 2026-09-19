import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { getLeads } from "@/lib/store";
import { processLead } from "@/lib/leads";
import { writeAuditEvent } from "@/lib/audit";
import { clientIp } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireSupabase } from "@/lib/lifecycle/core";
import { getLeadRow, listLeadsPage } from "@/lib/lifecycle/paged-admin";
import { parseListParams } from "@/lib/apiv1/pagination";
import { searchTerm } from "@/lib/apiv1/search";
import { toLeadDto } from "@/lib/apiv1/serializers-admin";
import { listQuery, createBody } from "@/lib/apiv1/resources/admin-leads";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";

// Cookie-route creates default to a distinct source than the v1 API's
// "api" default, so admin-console-created leads are attributable.
const CreateBody = createBody.extend({
  source: z.string().max(60).optional().default("admin_console"),
});

function unavailable() {
  return NextResponse.json({ error: "Supabase required" }, { status: 503 });
}

export async function GET(request: Request) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;

  const url = new URL(request.url);
  const sp = url.searchParams;
  const hasPagedParams =
    sp.has("q") || sp.has("status") || sp.has("limit") || sp.has("cursor");

  if (!hasPagedParams) {
    const leads = await getLeads();
    return NextResponse.json({ leads });
  }

  if (!isSupabaseConfigured()) return unavailable();

  const parsed = listQuery.safeParse({
    status: sp.get("status") ?? undefined,
    since: sp.get("since") ?? undefined,
    q: sp.get("q") ?? undefined,
    limit: sp.get("limit") ?? undefined,
    cursor: sp.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query." },
      { status: 400 }
    );
  }

  const { limit, cursor } = parseListParams(sp);
  const page = await listLeadsPage(requireSupabase(), {
    limit,
    cursor,
    q: searchTerm(parsed.data.q),
    status: parsed.data.status,
    since: parsed.data.since,
  });
  return NextResponse.json({
    data: page.data.map(toLeadDto),
    meta: { next_cursor: page.next_cursor, limit },
  });
}

export async function POST(request: Request) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;

  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  if (!isSupabaseConfigured()) return unavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid lead." },
      { status: 400 }
    );
  }

  const lead: Lead = {
    name: parsed.data.name,
    company: parsed.data.company,
    email: parsed.data.email,
    phone: parsed.data.phone,
    website: parsed.data.website,
    industry: parsed.data.industry,
    problem: parsed.data.message,
    improve: "",
    submittedAt: new Date().toISOString(),
    source: parsed.data.source,
    status: "new",
  };

  const result = await processLead(lead);
  if (!result.storedInDatabase || !result.leadId) {
    return NextResponse.json(
      { error: "The lead could not be stored." },
      { status: 503 }
    );
  }

  const row = await getLeadRow(requireSupabase(), result.leadId);
  if (!row) {
    return NextResponse.json(
      { error: "The lead could not be read back." },
      { status: 503 }
    );
  }

  await writeAuditEvent({
    actorType: "admin",
    actorId: ctx.admin.id,
    actorEmail: ctx.admin.email,
    action: "lead.create",
    entityType: "lead",
    entityId: row.id,
    ip: clientIp(request),
  });

  return NextResponse.json(
    { lead: toLeadDto(row) },
    { status: result.duplicate ? 200 : 201 }
  );
}
