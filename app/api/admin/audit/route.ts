import { NextResponse } from "next/server";
import { isAdminContext, requireAdmin } from "@/lib/admin-auth";
import { listAuditEvents } from "@/lib/audit";

export const runtime = "nodejs";

/** Exportable audit log for compliance questionnaires. */
export async function GET(request: Request) {
  const ctx = await requireAdmin("view_audit");
  if (!isAdminContext(ctx)) return ctx;

  const url = new URL(request.url);
  const limit = Math.min(
    500,
    Math.max(1, Number(url.searchParams.get("limit") || 100))
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const action = url.searchParams.get("action") || undefined;
  const format = url.searchParams.get("format") || "json";

  const events = await listAuditEvents({ limit, offset, action });

  if (format === "csv") {
    // Neutralize spreadsheet formula injection: a cell starting with = + - @
    // (or a control character) is executed as a formula by Excel/Sheets.
    // Prefix those with an apostrophe so they're treated as literal text.
    const cell = (v: unknown) => {
      const s = String(v ?? "");
      const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const header = "created_at,actor_type,actor_email,action,entity_type,entity_id,ip\n";
    const rows = (events as Record<string, unknown>[]).map((e) =>
      [
        e.created_at,
        e.actor_type,
        e.actor_email,
        e.action,
        e.entity_type,
        e.entity_id,
        e.ip,
      ]
        .map(cell)
        .join(",")
    );
    return new NextResponse(header + rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="audit-export.csv"',
      },
    });
  }

  return NextResponse.json({ events, limit, offset });
}
