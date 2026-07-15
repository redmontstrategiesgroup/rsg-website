import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";
import { writeAuditEvent } from "@/lib/audit";
import { clientIp } from "@/lib/security";

export const runtime = "nodejs";

const RequestSchema = z.object({
  email: z.string().email().max(320),
  action: z.enum(["export", "delete"]),
});

/**
 * DSAR helper: export or delete lead data by email (admin-only).
 */
export async function POST(request: Request) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;

  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "email and action required." }, { status: 400 });
  }

  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json(
      { error: "Supabase required for DSAR operations." },
      { status: 503 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();

  if (parsed.data.action === "export") {
    const leadsRes = await sb.from("leads").select("*").ilike("email", email);
    let bookings: unknown[] = [];
    try {
      const bookingRes = await sb
        .from("bookings")
        .select("id, starts_at, status, lead_id, leads(email)")
        .ilike("leads.email", email);
      bookings = bookingRes.data ?? [];
    } catch {
      bookings = [];
    }

    await writeAuditEvent({
      actorType: "admin",
      actorId: ctx.admin.id,
      actorEmail: ctx.admin.email,
      action: "dsar.export",
      entityType: "lead",
      metadata: { email },
      ip: clientIp(request),
    });

    return NextResponse.json({
      email,
      leads: leadsRes.data ?? [],
      bookings,
      exportedAt: new Date().toISOString(),
    });
  }

  const { data: leadRows } = await sb
    .from("leads")
    .select("id")
    .ilike("email", email);
  const ids = (leadRows ?? []).map((r: { id: string }) => r.id);

  if (ids.length) {
    try {
      await sb.from("bookings").delete().in("lead_id", ids);
    } catch {
      /* bookings table may not reference lead_id on older schemas */
    }
    await sb.from("leads").delete().in("id", ids);
  }

  await writeAuditEvent({
    actorType: "admin",
    actorId: ctx.admin.id,
    actorEmail: ctx.admin.email,
    action: "dsar.delete",
    entityType: "lead",
    metadata: { email, deletedLeadIds: ids },
    ip: clientIp(request),
  });

  return NextResponse.json({
    ok: true,
    deletedLeads: ids.length,
    email,
  });
}
