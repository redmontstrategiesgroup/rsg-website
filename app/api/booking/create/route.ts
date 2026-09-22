import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import { completeBooking } from "@/lib/scheduling/book-flow";
import { sessionBodySchema } from "@/lib/scheduling/book-flow-schema";

export const runtime = "nodejs";

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
    const body = sessionBodySchema.parse(await request.json());
    const r = await completeBooking({
      ...body,
      idempotencyKey:
        body.idempotencyKey ||
        request.headers.get("idempotency-key") ||
        undefined,
    });

    if (!r.ok) {
      return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
    }

    return NextResponse.json({
      ok: true,
      bookingId: r.bookingId,
      manageToken: r.manageToken,
      confirmedUrl: r.confirmedUrl,
      ...(r.recommendedPlanKey
        ? { recommendedPlanKey: r.recommendedPlanKey, recommendedPlanName: r.recommendedPlanName }
        : {}),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Please check the highlighted fields and try again." },
        { status: 400 }
      );
    }
    console.error("[booking/create]", err);
    return NextResponse.json(
      { error: "Unable to create booking." },
      { status: 500 }
    );
  }
}
