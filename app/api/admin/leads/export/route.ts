import { NextResponse } from "next/server";
import { isAdminContext, requireAdmin } from "@/lib/admin-auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireSupabase } from "@/lib/lifecycle/core";
import { listLeadsPage } from "@/lib/lifecycle/paged-admin";
import { decodeCursor } from "@/lib/apiv1/pagination";
import { searchTerm } from "@/lib/apiv1/search";
import { toCsv } from "@/lib/apiv1/csv";
import { LEAD_CSV_COLUMNS, exportQuery } from "@/lib/apiv1/resources/admin-leads";
import { rateLimit, rateLimitResponse } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;

  // Matches the v1 twin's 10 / 10 min cap (docs/api-platform.md §Admin
  // endpoints) — this is an unbounded-scan-capable 10k-row export, not a
  // read to leave unthrottled. Deliberately not rateLimitAdminMutator,
  // whose 120 / 10 min mutator cap is far looser than the export needs.
  if (!(await rateLimit(`admin-leads-export:${ctx.admin.id}`, 10, 10 * 60_000))) {
    return rateLimitResponse();
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase required" }, { status: 503 });
  }

  const sp = new URL(request.url).searchParams;
  const parsed = exportQuery.safeParse({
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

  const csv = toCsv(all.slice(0, 10_000), LEAD_CSV_COLUMNS);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
    },
  });
}
