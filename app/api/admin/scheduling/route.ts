import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireSupabase, adminTimezone, siteUrl } from "@/lib/scheduling/db";
import { DateTime } from "luxon";
import {
  getSettings,
  sendTemplatedEmail,
} from "@/lib/scheduling/notifications";
import { computeQualification } from "@/lib/scheduling/qualification";
import { getPublishedQualification } from "@/lib/scheduling/catalog";
import {
  cancelBooking,
  createBooking,
  rescheduleBooking,
} from "@/lib/scheduling/booking";
import { createBookingSession } from "@/lib/scheduling/sessions";
import { updateLeadStatus } from "@/lib/scheduling/leads";
import { createSecureToken } from "@/lib/scheduling/tokens";
import { logActivity } from "@/lib/scheduling/analytics";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import {
  can,
  SCHEDULING_ACTION_PERMISSION,
  SCHEDULING_SECTION_PERMISSION,
} from "@/lib/scheduling/permissions";
import { writeAuditEvent } from "@/lib/audit";
import { clientIp } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ctx = await requireAdmin("view_appointments");
  if (!isAdminContext(ctx)) return ctx;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase required" }, { status: 503 });
  }

  const url = new URL(request.url);
  const section = url.searchParams.get("section") || "dashboard";
  const needed =
    SCHEDULING_SECTION_PERMISSION[section] ?? ("view_appointments" as const);
  if (!can(needed, ctx.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sb = requireSupabase();

  try {
    if (section === "dashboard") {
      const now = DateTime.now().setZone(adminTimezone());
      const dayStart = now.startOf("day").toUTC().toISO()!;
      const dayEnd = now.endOf("day").toUTC().toISO()!;
      const weekStart = now.startOf("week").toUTC().toISO()!;
      const weekEnd = now.endOf("week").toUTC().toISO()!;

      const [
        today,
        week,
        upcoming,
        pendingReview,
        qualifiedNotBooked,
        bookings,
        leads,
        failedEmails,
        types,
      ] = await Promise.all([
        sb
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .gte("starts_at", dayStart)
          .lte("starts_at", dayEnd)
          .in("status", ["confirmed", "rescheduled"])
          .eq("is_test", false),
        sb
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .gte("starts_at", weekStart)
          .lte("starts_at", weekEnd)
          .in("status", ["confirmed", "rescheduled"])
          .eq("is_test", false),
        sb
          .from("bookings")
          .select(
            "id, starts_at, status, appointment_types(name), leads(name, business_name)"
          )
          .gte("starts_at", now.toUTC().toISO()!)
          .in("status", ["confirmed", "rescheduled"])
          .eq("is_test", false)
          .order("starts_at", { ascending: true })
          .limit(10),
        sb
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("status", "manual_review")
          .eq("is_test", false),
        sb
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("status", "qualified_not_booked")
          .eq("is_test", false),
        sb
          .from("bookings")
          .select("status, appointment_type_id")
          .eq("is_test", false)
          .gte("created_at", now.minus({ days: 90 }).toUTC().toISO()!),
        sb
          .from("leads")
          .select(
            "qualification_outcome, qualification_score, source, service_requested, status"
          )
          .eq("is_test", false)
          .eq("source", "website_booking_funnel")
          .gte("created_at", now.minus({ days: 90 }).toUTC().toISO()!),
        sb
          .from("notification_deliveries")
          .select("id, recipient, subject, error, created_at")
          .eq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(10),
        sb.from("appointment_types").select("id, name").is("deleted_at", null),
      ]);

      const bookingRows = bookings.data ?? [];
      const totalBookings = bookingRows.length;
      const cancelled = bookingRows.filter((b) => b.status === "cancelled").length;
      const rescheduled = bookingRows.filter((b) => b.status === "rescheduled").length;
      const noShow = bookingRows.filter((b) => b.status === "no_show").length;
      const leadRows = leads.data ?? [];
      const intakeComplete = leadRows.filter((l) =>
        [
          "qualified",
          "manual_review",
          "not_eligible",
          "qualified_not_booked",
          "appointment_booked",
        ].includes(l.status)
      ).length;
      const booked = leadRows.filter((l) => l.status === "appointment_booked").length;
      const scored = leadRows.filter((l) => l.qualification_score != null);
      const avgScore =
        scored.length > 0
          ? Math.round(
              scored.reduce((s, l) => s + (l.qualification_score as number), 0) /
                scored.length
            )
          : 0;

      const typeCounts = new Map<string, number>();
      for (const b of bookingRows) {
        if (b.appointment_type_id) {
          typeCounts.set(
            b.appointment_type_id,
            (typeCounts.get(b.appointment_type_id) ?? 0) + 1
          );
        }
      }
      let popularType = "—";
      let maxT = 0;
      for (const t of types.data ?? []) {
        const c = typeCounts.get(t.id) ?? 0;
        if (c > maxT) {
          maxT = c;
          popularType = t.name;
        }
      }

      const serviceCounts = new Map<string, number>();
      for (const l of leadRows) {
        if (l.service_requested) {
          serviceCounts.set(
            l.service_requested,
            (serviceCounts.get(l.service_requested) ?? 0) + 1
          );
        }
      }
      let popularService = "—";
      let maxS = 0;
      for (const [k, v] of serviceCounts) {
        if (v > maxS) {
          maxS = v;
          popularService = k;
        }
      }

      const byOutcome: Record<string, number> = {};
      for (const l of leadRows) {
        const o = l.qualification_outcome || "unknown";
        byOutcome[o] = (byOutcome[o] ?? 0) + 1;
      }
      const bySource: Record<string, number> = {};
      for (const l of leadRows) {
        const o = l.source || "unknown";
        bySource[o] = (bySource[o] ?? 0) + 1;
      }

      return NextResponse.json({
        today: today.count ?? 0,
        week: week.count ?? 0,
        upcoming: upcoming.data ?? [],
        pendingReview: pendingReview.count ?? 0,
        qualifiedNotBooked: qualifiedNotBooked.count ?? 0,
        conversionRate:
          intakeComplete > 0 ? Math.round((booked / intakeComplete) * 100) : 0,
        cancellationRate:
          totalBookings > 0 ? Math.round((cancelled / totalBookings) * 100) : 0,
        rescheduleRate:
          totalBookings > 0 ? Math.round((rescheduled / totalBookings) * 100) : 0,
        noShowRate:
          totalBookings > 0 ? Math.round((noShow / totalBookings) * 100) : 0,
        popularType,
        popularService,
        avgScore,
        byOutcome,
        bySource,
        failedEmails: failedEmails.data ?? [],
      });
    }

    if (section === "bookings") {
      const page = Number(url.searchParams.get("page") || "1");
      const pageSize = 25;
      const from = (page - 1) * pageSize;
      const status = url.searchParams.get("status");
      let q = sb
        .from("bookings")
        .select(
          "*, appointment_types(name, slug), team_members(name, email), leads(name, email, phone, business_name, qualification_score, qualification_outcome, service_requested, status, qualification_snapshot)",
          { count: "exact" }
        )
        .order("starts_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (status) q = q.eq("status", status);
      const { data, count, error } = await q;
      if (error) throw error;
      return NextResponse.json({ bookings: data, total: count, page, pageSize });
    }

    if (section === "calendar") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      let q = sb
        .from("bookings")
        .select(
          "id, starts_at, ends_at, status, meeting_format, manage_token, appointment_types(name, color), team_members(name), leads(name, business_name)"
        )
        .in("status", ["confirmed", "rescheduled", "completed", "no_show"])
        .order("starts_at", { ascending: true });
      if (from) q = q.gte("starts_at", from);
      if (to) q = q.lte("starts_at", to);
      const { data, error } = await q;
      if (error) throw error;
      const { data: blocks } = await sb
        .from("calendar_blocks")
        .select("*")
        .gte("ends_at", from || new Date().toISOString())
        .lte(
          "starts_at",
          to || DateTime.now().plus({ days: 60 }).toISO()!
        );
      return NextResponse.json({ bookings: data ?? [], blocks: blocks ?? [] });
    }

    if (section === "config") {
      const [
        services,
        types,
        members,
        questions,
        ruleSets,
        templates,
        schedules,
        windows,
        settings,
        webhooks,
        jobs,
        deliveries,
        integrations,
        activity,
      ] = await Promise.all([
        sb.from("services").select("*").is("deleted_at", null).order("sort_order"),
        sb
          .from("appointment_types")
          .select("*")
          .is("deleted_at", null)
          .order("duration_minutes"),
        sb.from("team_members").select("*").is("deleted_at", null),
        sb.from("qualification_questions").select("*").order("sort_order"),
        sb
          .from("qualification_rule_sets")
          .select("*")
          .order("updated_at", { ascending: false }),
        sb.from("notification_templates").select("*").order("key"),
        sb.from("availability_schedules").select("*"),
        sb.from("availability_windows").select("*"),
        getSettings(),
        sb.from("webhook_endpoints").select("*"),
        sb
          .from("notification_jobs")
          .select("*")
          .in("status", ["failed", "pending"])
          .order("due_at", { ascending: false })
          .limit(50),
        sb
          .from("notification_deliveries")
          .select("*")
          .eq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(50),
        sb.from("calendar_integrations").select("*"),
        sb
          .from("scheduling_activity_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

      return NextResponse.json({
        services: services.data ?? [],
        appointmentTypes: types.data ?? [],
        teamMembers: members.data ?? [],
        questions: questions.data ?? [],
        ruleSets: ruleSets.data ?? [],
        templates: templates.data ?? [],
        schedules: schedules.data ?? [],
        windows: windows.data ?? [],
        settings,
        webhooks: webhooks.data ?? [],
        jobs: jobs.data ?? [],
        failedDeliveries: deliveries.data ?? [],
        integrations: integrations.data ?? [],
        activity: activity.data ?? [],
      });
    }

    return NextResponse.json({ error: "Unknown section" }, { status: 400 });
  } catch (err) {
    console.error("[admin/scheduling GET]", err);
    return NextResponse.json(
      { error: "Failed to load scheduling data" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const ctx = await requireAdmin("view_appointments");
  if (!isAdminContext(ctx)) return ctx;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase required" }, { status: 503 });
  }

  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  const sb = requireSupabase();
  const body = await request.json();
  const action = body.action as string;
  const needed = SCHEDULING_ACTION_PERMISSION[action];
  if (needed && !can(needed, ctx.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await writeAuditEvent({
      actorType: "admin",
      actorId: ctx.admin.id,
      actorEmail: ctx.admin.email,
      action: `scheduling.${action || "unknown"}`,
      entityType: "scheduling",
      metadata: { action },
      ip: clientIp(request),
    });
    if (action === "upsert_service") {
      const row = body.service;
      if (row.id) {
        await sb
          .from("services")
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq("id", row.id);
      } else {
        await sb.from("services").insert(row);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "upsert_appointment_type") {
      const row = body.appointmentType;
      if (row.id) {
        await sb
          .from("appointment_types")
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq("id", row.id);
      } else {
        await sb.from("appointment_types").insert(row);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "upsert_question") {
      const row = body.question;
      if (row.id) {
        await sb
          .from("qualification_questions")
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq("id", row.id);
      } else {
        await sb.from("qualification_questions").insert(row);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "reorder_questions") {
      for (const item of body.items as { id: string; sort_order: number }[]) {
        await sb
          .from("qualification_questions")
          .update({ sort_order: item.sort_order })
          .eq("id", item.id);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "save_rule_set") {
      const row = body.ruleSet;
      if (row.id) {
        await sb
          .from("qualification_rule_sets")
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq("id", row.id);
      } else {
        await sb.from("qualification_rule_sets").insert(row);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "publish_rule_set") {
      const id = body.id as string;
      const { data: rule } = await sb
        .from("qualification_rule_sets")
        .select("*")
        .eq("id", id)
        .single();
      if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await sb
        .from("qualification_rule_sets")
        .update({ status: "archived" })
        .eq("form_id", rule.form_id)
        .eq("status", "published")
        .neq("id", id);
      await sb
        .from("qualification_rule_sets")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      const { data: versions } = await sb
        .from("qualification_rule_versions")
        .select("version")
        .eq("rule_set_id", id)
        .order("version", { ascending: false })
        .limit(1);
      const nextVersion = (versions?.[0]?.version ?? 0) + 1;
      await sb.from("qualification_rule_versions").insert({
        rule_set_id: id,
        version: nextVersion,
        snapshot: rule,
      });
      return NextResponse.json({ ok: true, version: nextVersion });
    }

    if (action === "test_qualification") {
      const published = await getPublishedQualification();
      if (!published?.ruleSet) {
        return NextResponse.json({ error: "No published rules" }, { status: 400 });
      }
      const result = computeQualification({
        questions: published.questions,
        ruleSet: published.ruleSet,
        answers: body.answers ?? {},
        serviceId: body.serviceId,
      });
      return NextResponse.json({ result, isTest: true });
    }

    if (action === "override_qualification") {
      const leadId = body.leadId as string;
      const outcome = body.outcome as string;
      await sb
        .from("leads")
        .update({
          qualification_outcome: outcome,
          status:
            outcome === "qualified"
              ? "qualified"
              : outcome === "manual_review"
                ? "manual_review"
                : "not_eligible",
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);
      await sb.from("qualification_results").insert({
        lead_id: leadId,
        total_score: body.score ?? 0,
        max_score: 0,
        outcome,
        priority: "medium",
        rule_hits: [],
        score_breakdown: {},
        overridden_by: ctx.admin.email,
        override_outcome: outcome,
      });
      await logActivity({
        entityType: "lead",
        entityId: leadId,
        leadId,
        action: "qualification_overridden",
        actor: ctx.admin.email,
        detail: { outcome },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "save_availability_windows") {
      const scheduleId = body.scheduleId as string;
      const windows = body.windows as Record<string, unknown>[];
      await sb.from("availability_windows").delete().eq("schedule_id", scheduleId);
      if (windows.length) {
        await sb.from("availability_windows").insert(
          windows.map((w) => ({ ...w, schedule_id: scheduleId }))
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "add_block") {
      await sb.from("calendar_blocks").insert(body.block);
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_block") {
      await sb.from("calendar_blocks").delete().eq("id", body.id);
      return NextResponse.json({ ok: true });
    }

    if (action === "update_settings") {
      await sb
        .from("scheduling_settings")
        .update({ ...body.settings, updated_at: new Date().toISOString() })
        .eq("id", "default");
      return NextResponse.json({ ok: true });
    }

    if (action === "update_template") {
      const t = body.template;
      await sb
        .from("notification_templates")
        .update({
          subject: t.subject,
          body_html: t.body_html,
          body_text: t.body_text,
          enabled: t.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", t.id);
      return NextResponse.json({ ok: true });
    }

    if (action === "send_test_email") {
      const settings = await getSettings();
      const to = body.to || ctx.admin.email || settings.reply_to;
      await sendTemplatedEmail({
        templateKey: body.templateKey || "visitor_submission",
        to,
        vars: {
          first_name: "Test",
          full_name: "Test User",
          business_name: "Test Business",
          email: to,
          appointment_type: "Strategy Consultation",
          appointment_time_local: new Date().toLocaleString(),
          manage_url: `${siteUrl()}/book`,
          book_url: `${siteUrl()}/book`,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "create_manual_booking") {
      const session = await createBookingSession({
        isTest: Boolean(body.isTest),
        appointmentTypeId: body.appointmentTypeId,
        timezone: body.timezone || "America/New_York",
      });
      // Force is_test + qualified on session for admin path
      await sb
        .from("booking_sessions")
        .update({
          qualification_outcome: "qualified",
          contact: body.contact,
          lead_id: body.leadId ?? null,
          is_test: Boolean(body.isTest),
        })
        .eq("id", session.id);

      // Re-fetch token path: createBooking checks is_test for eligibility bypass
      const result = await createBooking({
        sessionId: session.id,
        sessionToken: session.token,
        appointmentTypeId: body.appointmentTypeId,
        startsAt: body.startsAt,
        meetingFormat: body.meetingFormat || "phone",
        visitorTimezone: body.timezone || "America/New_York",
        visitorNotes: body.notes,
        idempotencyKey: body.idempotencyKey || createSecureToken(12),
      });
      return NextResponse.json(result);
    }

    if (action === "admin_cancel") {
      const { data: booking } = await sb
        .from("bookings")
        .select("manage_token")
        .eq("id", body.bookingId)
        .maybeSingle();
      if (!booking)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(
        await cancelBooking({
          manageToken: booking.manage_token,
          reason: body.reason,
          actor: "admin",
        })
      );
    }

    if (action === "admin_reschedule") {
      const { data: booking } = await sb
        .from("bookings")
        .select("manage_token")
        .eq("id", body.bookingId)
        .maybeSingle();
      if (!booking)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(
        await rescheduleBooking({
          manageToken: booking.manage_token,
          startsAt: body.startsAt,
          actor: "admin",
        })
      );
    }

    if (action === "mark_status") {
      await sb
        .from("bookings")
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq("id", body.bookingId);
      if (body.leadId && body.status) {
        const map: Record<string, string> = {
          completed: "completed",
          no_show: "no_show",
          cancelled: "cancelled",
        };
        if (map[body.status]) await updateLeadStatus(body.leadId, map[body.status]);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "send_booking_link") {
      const { data: session } = await sb
        .from("booking_sessions")
        .select("*")
        .eq("id", body.sessionId)
        .maybeSingle();
      if (!session)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      const contact = session.contact as { email?: string; firstName?: string };
      if (!contact?.email) {
        return NextResponse.json({ error: "No email" }, { status: 400 });
      }
      const finishUrl = `${siteUrl()}/book?session=${session.token}`;
      await sendTemplatedEmail({
        templateKey: "visitor_finish_booking",
        to: contact.email,
        vars: {
          first_name: contact.firstName ?? "",
          finish_booking_url: finishUrl,
        },
        leadId: session.lead_id,
      });
      await sb
        .from("booking_sessions")
        .update({
          booking_link_sent_at: new Date().toISOString(),
          follow_up_count: (session.follow_up_count ?? 0) + 1,
        })
        .eq("id", session.id);
      return NextResponse.json({ ok: true, url: finishUrl });
    }

    if (action === "upsert_webhook") {
      const row = { ...body.webhook };
      if (!row.secret) row.secret = createSecureToken(24);
      if (row.id) await sb.from("webhook_endpoints").update(row).eq("id", row.id);
      else await sb.from("webhook_endpoints").insert(row);
      return NextResponse.json({ ok: true });
    }

    if (action === "upsert_team_member") {
      const row = body.member;
      if (row.id) await sb.from("team_members").update(row).eq("id", row.id);
      else await sb.from("team_members").insert(row);
      return NextResponse.json({ ok: true });
    }

    if (action === "update_internal_notes") {
      await sb
        .from("bookings")
        .update({
          internal_notes: body.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.bookingId);
      return NextResponse.json({ ok: true });
    }

    if (action === "pause_bookings") {
      await sb
        .from("scheduling_settings")
        .update({
          bookings_paused: Boolean(body.paused),
          updated_at: new Date().toISOString(),
        })
        .eq("id", "default");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[admin/scheduling POST]", err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
