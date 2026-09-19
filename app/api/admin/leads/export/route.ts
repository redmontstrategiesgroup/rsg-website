import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminContext, requireAdmin } from "@/lib/admin-auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireSupabase } from "@/lib/lifecycle/core";
import { listLeadsPage } from "@/lib/lifecycle/paged-admin";
import { decodeCursor } from "@/lib/apiv1/pagination";
import { searchTerm } from "@/lib/apiv1/search";
import { toCsv } from "@/lib/apiv1/csv";
import { LEAD_CSV_COLUMNS, LEAD_STATUSES } from "@/lib/apiv1/resources/admin-leads";

export const runtime = "nodejs";

const ExportQuery = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  since: z.string().datetime().optional(),
  q: z.string().max(80).optional(),
});

export async function GET(request: Request) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase required" }, { status: 503 });
  }

  const sp = new URL(request.url).searchParams;
  const parsed = ExportQuery.safeParse({
    status: sp.get("status") ?? undefined,
    since: sp.get("since") ?? undefined,
    q: sp.get("q") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query." },
      { status: 400 }
    );
  }

  const sb = requireSupabase();
  const q = searchTerm(parsed.data.q);
  const all: Parameters<typeof toCsv>[0] = [];
  let cursor = null as ReturnType<typeof decodeCursor>;
  do {
    const page = await listLeadsPage(sb, {
      limit: 1000,
      cursor,
      q,
      status: parsed.data.status,
      since: parsed.data.since,
    });
    all.push(...(page.data as unknown as Record<string, unknown>[]));
    cursor = page.next_cursor ? decodeCursor(page.next_cursor) : null;
  } while (cursor && all.length < 10_000);

  const csv = toCsv(all, LEAD_CSV_COLUMNS);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
    },
  });
}
