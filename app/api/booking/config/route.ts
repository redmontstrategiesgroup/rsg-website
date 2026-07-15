import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  listActiveServices,
  listPublicAppointmentTypes,
  getPublishedQualification,
} from "@/lib/scheduling/catalog";
import { getSettings } from "@/lib/scheduling/notifications";
import {
  EMPLOYEE_COUNT_OPTIONS,
  MONTHLY_REVENUE_OPTIONS,
  HEARD_ABOUT_OPTIONS,
  MEETING_FORMAT_LABELS,
} from "@/lib/scheduling/types";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";

export const runtime = "nodejs";

/** Public catalog for the booking funnel (no scoring rules or thresholds). */
export async function GET(request: Request) {
  if (!(await rateLimit(`booking-config:${clientIp(request)}`, 60, 60_000))) {
    return rateLimitResponse();
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Scheduling is temporarily unavailable." },
      { status: 503 }
    );
  }

  try {
    const [services, appointmentTypes, published, settings] = await Promise.all([
      listActiveServices(),
      listPublicAppointmentTypes(),
      getPublishedQualification(),
      getSettings(),
    ]);

    const questions = (published?.questions ?? []).map((q) => ({
      id: q.id,
      key: q.key,
      label: q.label,
      helpText: q.help_text,
      type: q.question_type,
      options: q.options,
      required: q.required,
      sortOrder: q.sort_order,
      parentQuestionId: q.parent_question_id,
      showWhen: q.show_when,
      // Intentionally omit point_map / max_points
    }));

    return NextResponse.json({
      services,
      appointmentTypes: appointmentTypes.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.public_description,
        durationMinutes: t.duration_minutes,
        meetingFormats: t.meeting_formats,
        color: t.color,
      })),
      questions,
      bookingsPaused: settings.bookings_paused,
      options: {
        employeeCount: EMPLOYEE_COUNT_OPTIONS,
        monthlyRevenue: MONTHLY_REVENUE_OPTIONS,
        heardAbout: HEARD_ABOUT_OPTIONS,
        meetingFormats: MEETING_FORMAT_LABELS,
      },
      turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null,
    });
  } catch (err) {
    console.error("[booking/config]", err);
    return NextResponse.json(
      { error: "Unable to load booking configuration." },
      { status: 500 }
    );
  }
}
