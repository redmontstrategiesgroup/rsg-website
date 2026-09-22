import { z } from "zod";
import { createBooking } from "./booking";
import { getSessionByToken } from "./sessions";
import { submitIntake } from "./intake";
import type { IntakeAnswers, IntakeContact } from "./intake-schema";
import {
  recommendPlan,
  sanitizeServicePlanAnswers,
} from "@/lib/managed-services/recommend";
import { defaultPlanByKey } from "@/lib/managed-services/content";
import { bookingBodySchema } from "./book-flow-schema";
import type { Attribution } from "./types";

export { bookingBodySchema, sessionBodySchema, createBody, attributionSchema } from "./book-flow-schema";

export type BookFlowResult =
  | {
      ok: true;
      bookingId: string;
      manageToken: string;
      confirmedUrl: string;
      recommendedPlanKey?: string;
      recommendedPlanName?: string | null;
    }
  | { ok: false; status: 400 | 401 | 403 | 409; error: string; code?: string };

/**
 * Session → intake → booking → best-effort lifecycle hook → best-effort
 * managed-services recommendation. Moved verbatim out of the cookie route
 * (`app/api/booking/create/route.ts`) so it can be shared with the public
 * booking API. Never throws for expected failures and never touches
 * `NextResponse` — callers map the discriminated result to their own
 * response shape.
 *
 * Callers MUST pass values already parsed through `bookingBodySchema` (or
 * `sessionBodySchema`/`createBody`, which extend it) — `submitIntake` does
 * not re-parse or re-apply zod defaults itself.
 */
export async function completeBooking(
  // z.input (not z.infer/output): the defaulted intake-contact fields
  // (industry, website, preferredContact) are optional to a caller — the
  // route already parsed the request through bookingBodySchema (which
  // fills them in) before calling this, and direct callers (tests, the
  // public handler before submitIntake runs) may omit them too.
  input: z.input<typeof bookingBodySchema> & {
    sessionToken: string;
    idempotencyKey?: string;
  }
): Promise<BookFlowResult> {
  const session = await getSessionByToken(input.sessionToken);
  if (!session) {
    return { ok: false, status: 401, error: "Session expired." };
  }

  if (input.intake) {
    const intake = await submitIntake({
      sessionToken: input.sessionToken,
      // Cast: completeBooking accepts z.input (defaulted fields optional)
      // so direct callers need not restate them, but by the time this runs
      // the caller has always parsed through bookingBodySchema (or a mock
      // stands in for submitIntake in tests), so the defaults are present.
      contact: input.intake.contact as IntakeContact,
      answers: (input.intake.answers ?? {}) as IntakeAnswers,
      consent: input.intake.consent,
    });
    if (!intake.ok) {
      return { ok: false, status: 400, error: intake.error, code: intake.code };
    }
  }

  const result = await createBooking({
    sessionId: session.id,
    sessionToken: input.sessionToken,
    appointmentTypeId: input.appointmentTypeId,
    startsAt: input.startsAt,
    meetingFormat: input.meetingFormat,
    visitorTimezone: input.visitorTimezone,
    visitorNotes: input.visitorNotes,
    idempotencyKey: input.idempotencyKey || undefined,
  });

  if (!result.ok) {
    const status =
      result.code === "conflict"
        ? 409
        : result.code === "not_eligible"
          ? 403
          : 400;
    return { ok: false, status, error: result.error, code: result.code };
  }

  // Lifecycle hook: create the preparation questionnaire, advance the
  // journey, and send the invite email. Best-effort; never blocks booking.
  try {
    const fresh = await getSessionByToken(input.sessionToken);
    const contact = (fresh?.contact ?? {}) as {
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
        name: contact.name ?? "",
        businessName: contact.businessName,
        appointmentStartsAt: input.startsAt,
        appointmentTimeLocal: new Date(input.startsAt).toLocaleString("en-US", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: input.visitorTimezone,
        }),
        serviceCategory: serviceCategoryForSlug(serviceSlug),
      });
    }
  } catch (lifecycleError) {
    console.error("[book-flow] lifecycle hook failed", lifecycleError);
  }

  // Consultative managed-services recommendation from the optional
  // ongoing-support answers. Pure computation, never blocks booking.
  let recommendedPlanKey: string | null = null;
  let recommendedPlanName: string | null = null;
  try {
    const sanitized = sanitizeServicePlanAnswers(
      input.intake?.answers?.servicePlan
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
    bookingId: result.bookingId,
    manageToken: result.manageToken,
    confirmedUrl: `/booking/confirmed?token=${result.manageToken}${
      recommendedPlanKey ? `&plan=${recommendedPlanKey}` : ""
    }`,
    ...(recommendedPlanKey
      ? { recommendedPlanKey, recommendedPlanName }
      : {}),
  };
}

/** Create a fresh booking session for an anonymous public-API caller. */
export async function startPublicSession(input: {
  appointmentTypeId?: string;
  timezone?: string;
  attribution?: Attribution;
}): Promise<{ token: string }> {
  const { createBookingSession } = await import("./sessions");
  const { token } = await createBookingSession({
    appointmentTypeId: input.appointmentTypeId,
    timezone: input.timezone,
    attribution: input.attribution,
  });
  return { token };
}
