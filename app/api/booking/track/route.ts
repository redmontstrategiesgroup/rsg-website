import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getSessionByToken } from "@/lib/scheduling/sessions";
import { trackSchedulingEvent } from "@/lib/scheduling/analytics";

export const runtime = "nodejs";

/**
 * Funnel analytics for the public booking flow. Events are keyed to a valid
 * booking session and carry only non-identifying metadata (category slug,
 * step name) — never names, emails, phone numbers, or free-text answers.
 */

const EVENTS = [
  "booking_page_viewed",
  "help_category_selected",
  "not_sure_selected",
  "date_selected",
  "time_selected",
  "form_started",
  "booking_submitted",
  "booking_completed",
  "validation_error",
  "booking_abandoned",
] as const;

const schema = z.object({
  // The page-view event fires before a session exists; everything else must
  // reference a valid session token.
  token: z.string().min(20).max(200).optional(),
  event: z.enum(EVENTS),
  meta: z
    .object({
      category: z.string().max(80).optional(),
      step: z.string().max(40).optional(),
      field: z.string().max(60).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const ip = clientIp(request);
  if (!(await rateLimit(`booking-track:${ip}`, 60, 60 * 1000))) {
    return rateLimitResponse();
  }

  try {
    const body = schema.parse(await request.json());
    const session = body.token ? await getSessionByToken(body.token) : null;
    if (!session && body.event !== "booking_page_viewed") {
      return NextResponse.json({ ok: true });
    }

    await trackSchedulingEvent({
      eventType: body.event,
      sessionId: session?.id,
      leadId: session?.lead_id ?? undefined,
      serviceId: session?.service_id ?? undefined,
      appointmentTypeId: session?.appointment_type_id ?? undefined,
      meta: body.meta ?? {},
      isTest: session?.is_test ?? false,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Analytics must never surface errors to the visitor.
    return NextResponse.json({ ok: true });
  }
}
