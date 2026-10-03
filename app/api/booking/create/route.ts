import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  createBooking,
  findBookingByIdempotencyKey,
} from "@/lib/scheduling/booking";
import { getSessionByToken } from "@/lib/scheduling/sessions";
import {
  intakeAnswersSchema,
  intakeContactSchema,
  submitIntake,
} from "@/lib/scheduling/intake";
import { sessionContactName } from "@/lib/scheduling/intake-schema";
import {
  recommendPlan,
  sanitizeServicePlanAnswers,
} from "@/lib/managed-services/recommend";
import { defaultPlanByKey } from "@/lib/managed-services/content";

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
  // Simplified funnel: contact details ride along with the final submit so
  // intake + booking happen in one request (no separate qualification step).
  intake: z
    .object({
      contact: intakeContactSchema,
      answers: intakeAnswersSchema,
      consent: z.boolean(),
    })
    .optional(),
});

/**
 * Success payload, shared by a fresh booking and an idempotent retry so the
 * retry lands on the same confirmation page. Includes the consultative
 * managed-services recommendation from the optional ongoing-support answers
 * (pure computation, never blocks booking).
 */
function bookingResponse(
  bookingId: string,
  manageToken: string,
  body: z.infer<typeof schema>
) {
  let recommendedPlanKey: string | null = null;
  let recommendedPlanName: string | null = null;
  try {
    const sanitized = sanitizeServicePlanAnswers(
      body.intake?.answers?.servicePlan
    );
    const rec = recommendPlan(sanitized);
    if (rec) {
      recommendedPlanKey = rec.planKey;
      recommendedPlanName = defaultPlanByKey(rec.planKey)?.name ?? null;
    }
  } catch {
    /* recommendation is best-effort */
  }

  return {
    ok: true,
    bookingId,
    manageToken,
    confirmedUrl: `/booking/confirmed?token=${manageToken}${
      recommendedPlanKey ? `&plan=${recommendedPlanKey}` : ""
    }`,
    ...(recommendedPlanKey ? { recommendedPlanKey, recommendedPlanName } : {}),
  };
}

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

    const idempotencyKey =
      body.idempotencyKey || request.headers.get("idempotency-key") || undefined;

    // A retried submit (double-click, flaky network) must return the booking
    // it already made before anything else runs: re-running intake would log
    // a second intake_completed and rewind the session step, and re-running
    // the lifecycle hook would repeat its side effects.
    if (idempotencyKey) {
      const existing = await findBookingByIdempotencyKey(idempotencyKey);
      if (existing) {
        return NextResponse.json(
          bookingResponse(existing.bookingId, existing.manageToken, body)
        );
      }
    }

    if (body.intake) {
      const intake = await submitIntake({
        sessionToken: body.sessionToken,
        contact: body.intake.contact,
        answers: body.intake.answers,
        consent: body.intake.consent,
      });
      if (!intake.ok) {
        return NextResponse.json(
          { error: intake.error, code: intake.code },
          { status: 400 }
        );
      }
    }

    const result = await createBooking({
      sessionId: session.id,
      sessionToken: body.sessionToken,
      appointmentTypeId: body.appointmentTypeId,
      startsAt: body.startsAt,
      meetingFormat: body.meetingFormat,
      visitorTimezone: body.visitorTimezone,
      visitorNotes: body.visitorNotes,
      idempotencyKey,
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

    // Lifecycle hook: create the preparation questionnaire, advance the
    // journey, and send the invite email. Best-effort; never blocks booking.
    try {
      const fresh = await getSessionByToken(body.sessionToken);
      const contact = (fresh?.contact ?? {}) as {
        firstName?: string;
        lastName?: string;
        name?: string;
        email?: string;
        businessName?: string;
      };
      if (contact.email) {
        const { onBookingCreated } = await import("@/lib/lifecycle/orchestrate");
        const { serviceCategoryForSlug } = await import(
          "@/lib/lifecycle/category-map"
        );
        let serviceSlug: string | null = null;
        if (fresh?.service_id) {
          const { getSupabase } = await import("@/lib/supabase");
          const sb = getSupabase();
          if (sb) {
            const { data } = await sb
              .from("services")
              .select("slug")
              .eq("id", fresh.service_id)
              .maybeSingle();
            serviceSlug = (data?.slug as string | undefined) ?? null;
          }
        }
        await onBookingCreated({
          bookingId: result.bookingId!,
          leadId: fresh?.lead_id ?? null,
          email: contact.email,
          name: sessionContactName(contact),
          businessName: contact.businessName,
          appointmentStartsAt: body.startsAt,
          appointmentTimeLocal: new Date(body.startsAt).toLocaleString("en-US", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: body.visitorTimezone,
          }),
          serviceCategory: serviceCategoryForSlug(serviceSlug),
        });
      }
    } catch (lifecycleError) {
      console.error("[booking/create] lifecycle hook failed", lifecycleError);
    }

    return NextResponse.json(
      bookingResponse(result.bookingId, result.manageToken, body)
    );
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) {
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
