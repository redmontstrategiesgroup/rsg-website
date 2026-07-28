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
import { exportDataSubject, eraseDataSubject } from "@/lib/privacy/erase";

export const runtime = "nodejs";

const RequestSchema = z.object({
  email: z.string().email().max(320),
  action: z.enum(["export", "delete"]),
  // Erasure of a live portal client account (and its cascade of sessions,
  // subscriptions, roadmaps, service records) is destructive — require an
  // explicit opt-in rather than wiping an account as a side effect.
  includeClientAccount: z.boolean().optional(),
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

  // Exact match, not ILIKE, everywhere below: `_` and `%` are LIKE wildcards
  // and valid email characters, so a wildcard match on an attacker-influenced
  // address could reach a different person's data. Email is already lowercased.
  const email = parsed.data.email.trim().toLowerCase();

  if (parsed.data.action === "export") {
    // Full footprint, not just leads: bookings, newsletter subscription, and
    // any portal client account/team membership held for this person.
    const data = await exportDataSubject(sb, email);

    await writeAuditEvent({
      actorType: "admin",
      actorId: ctx.admin.id,
      actorEmail: ctx.admin.email,
      action: "dsar.export",
      entityType: "data_subject",
      metadata: {
        email,
        counts: {
          leads: data.leads.length,
          bookings: data.bookings.length,
          subscriber: data.subscriber.length,
          clientAccount: data.clientAccount.length,
          clientUsers: data.clientUsers.length,
        },
      },
      ip: clientIp(request),
    });

    return NextResponse.json(data);
  }

  // Erasure across every table that holds this subject's PII. The portal
  // client account is only removed when the admin explicitly opts in.
  const { outcomes, clientAccountPresent } = await eraseDataSubject(sb, email, {
    includeClientAccount: parsed.data.includeClientAccount === true,
  });

  const deleted = Object.fromEntries(
    outcomes.map((o) => [o.table, o.deleted])
  );
  const skipped = outcomes.filter((o) => o.status !== "ok");

  await writeAuditEvent({
    actorType: "admin",
    actorId: ctx.admin.id,
    actorEmail: ctx.admin.email,
    action: "dsar.delete",
    entityType: "data_subject",
    metadata: {
      email,
      deleted,
      includeClientAccount: parsed.data.includeClientAccount === true,
      clientAccountPresent,
      skipped: skipped.map((o) => ({ table: o.table, detail: o.detail })),
    },
    ip: clientIp(request),
  });

  return NextResponse.json({
    ok: true,
    email,
    deleted,
    // Surface, rather than silently ignore, a portal account that was left in
    // place — so the admin can consciously re-run with includeClientAccount.
    clientAccountPresent,
    clientAccountErased: parsed.data.includeClientAccount === true && clientAccountPresent,
    skipped: skipped.map((o) => o.table),
  });
}
