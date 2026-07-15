import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createBooking } from "@/lib/scheduling/booking";
import { getSessionByToken } from "@/lib/scheduling/sessions";

export const runtime = "nodejs";

const schema = z.object({
  sessionToken: z.string().min(20).max(200),
  appointmentTypeId: z.string().uuid(),
  startsAt: z.string().min(10).max(40),
  meetingFormat: z.enum([
    "phone",
    "google_meet",
    "zoom",
    "microsoft_teams",
    "in_person",
    "custom_link",
    "custom_location",
  ]),
  visitorTimezone: z.string().min(1).max(80),
  visitorNotes: z.string().max(2000).optional(),
  idempotencyKey: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Scheduling is temporarily unavailable." },
      { status: 503 }
    );
  }

  const ip = clientIp(request);
  if (!(await rateLimit(`booking-create:${ip}`, 10, 10 * 60 * 1000))) {
    return rateLimitResponse();
  }

  try {
    const body = schema.parse(await request.json());
    const session = await getSessionByToken(body.sessionToken);
    if (!session) {
      return NextResponse.json({ error: "Session expired." }, { status: 401 });
    }

    const result = await createBooking({
      sessionId: session.id,
      sessionToken: body.sessionToken,
      appointmentTypeId: body.appointmentTypeId,
      startsAt: body.startsAt,
      meetingFormat: body.meetingFormat,
      visitorTimezone: body.visitorTimezone,
      visitorNotes: body.visitorNotes,
      idempotencyKey:
        body.idempotencyKey ||
        request.headers.get("idempotency-key") ||
        undefined,
    });

    if (!result.ok) {
      const status =
        result.code === "conflict"
          ? 409
          : result.code === "not_eligible"
            ? 403
            : 400;
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status }
      );
    }

    return NextResponse.json({
      ok: true,
      bookingId: result.bookingId,
      manageToken: result.manageToken,
      confirmedUrl: `/booking/confirmed?token=${result.manageToken}`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    console.error("[booking/create]", err);
    return NextResponse.json(
      { error: "Unable to create booking." },
      { status: 500 }
    );
  }
}
