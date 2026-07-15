import { NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getSessionByToken } from "@/lib/scheduling/sessions";
import { getAvailableSlots } from "@/lib/scheduling/slots";
import { getSettings } from "@/lib/scheduling/notifications";
import { trackSchedulingEvent } from "@/lib/scheduling/analytics";
import { DateTime } from "luxon";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Scheduling is temporarily unavailable." },
      { status: 503 }
    );
  }

  const ip = clientIp(request);
  if (!(await rateLimit(`booking-slots:${ip}`, 60, 60 * 1000))) {
    return rateLimitResponse();
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const appointmentTypeId = url.searchParams.get("appointmentTypeId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const timezone = url.searchParams.get("timezone") || "America/New_York";

  if (!token || !appointmentTypeId) {
    return NextResponse.json({ error: "Missing parameters." }, { status: 400 });
  }

  const session = await getSessionByToken(token);
  if (!session) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  const settings = await getSettings();
  let allowManual = false;
  if (session.qualification_outcome === "manual_review") {
    const { requireSupabase } = await import("@/lib/scheduling/db");
    const sb = requireSupabase();
    const { data: rule } = await sb
      .from("qualification_rule_sets")
      .select("allow_calendar_on_manual_review")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    allowManual = Boolean(rule?.allow_calendar_on_manual_review);
  }

  if (
    session.qualification_outcome !== "qualified" &&
    !allowManual &&
    !session.is_test
  ) {
    return NextResponse.json(
      { error: "Not eligible to view availability." },
      { status: 403 }
    );
  }

  const fromDate =
    from || DateTime.now().setZone(timezone).toISODate()!;
  const toDate =
    to ||
    DateTime.fromISO(fromDate).plus({ days: 14 }).toISODate()!;

  if (settings.bookings_paused) {
    return NextResponse.json({ slots: [], paused: true });
  }

  const slots = await getAvailableSlots({
    appointmentTypeId,
    from: fromDate,
    to: toDate,
    visitorTimezone: timezone,
  });

  await trackSchedulingEvent({
    eventType: "booking_page_view",
    sessionId: session.id,
    appointmentTypeId,
    isTest: session.is_test,
  });

  return NextResponse.json({
    slots,
    from: fromDate,
    to: toDate,
    timezone,
  });
}
