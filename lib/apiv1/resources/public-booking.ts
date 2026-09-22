// lib/apiv1/resources/public-booking.ts
import { z } from "zod";
import { DateTime, IANAZone } from "luxon";
import { clientIp } from "@/lib/security";
import { keylessPrincipalId } from "@/lib/apiv1/idempotency";
import { ApiError } from "../errors";
import { completeBooking, startPublicSession } from "@/lib/scheduling/book-flow";
import { createBody } from "@/lib/scheduling/book-flow-schema";
import { getAvailableSlots } from "@/lib/scheduling/slots";
import { getSettings } from "@/lib/scheduling/notifications";
import { isTurnstileConfigured, verifyTurnstileStrict } from "@/lib/scheduling/turnstile";
import type { ApiHandler } from "../types.ts";

export { createBody };

export const slotsQuery = z.object({
  appointment_type_id: z.string().uuid(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  timezone: z.string().max(80).default("America/New_York"),
});

const MAX_WINDOW_DAYS = 31;
const DEFAULT_WINDOW_DAYS = 14;

export const listSlots: ApiHandler<undefined, z.infer<typeof slotsQuery>> = async ({ query }) => {
  if (!IANAZone.isValidZone(query.timezone)) {
    throw new ApiError(422, "validation_failed", "Invalid timezone.", { timezone: ["unrecognized"] });
  }

  const settings = await getSettings();
  if (settings.bookings_paused) {
    return { data: { slots: [], paused: true } };
  }

  const from = query.from ?? DateTime.now().setZone(query.timezone).toISODate()!;
  const to = query.to ?? DateTime.fromISO(from, { zone: query.timezone }).plus({ days: DEFAULT_WINDOW_DAYS }).toISODate()!;

  const windowDays = DateTime.fromISO(to, { zone: query.timezone }).diff(
    DateTime.fromISO(from, { zone: query.timezone }),
    "days"
  ).days;
  if (windowDays < 0 || windowDays > MAX_WINDOW_DAYS) {
    throw new ApiError(422, "validation_failed", "Date window cannot exceed 31 days.", { window: ["too large"] });
  }

  const slots = await getAvailableSlots({
    appointmentTypeId: query.appointment_type_id,
    from,
    to,
    visitorTimezone: query.timezone,
  });

  return { data: { slots, from, to, timezone: query.timezone } };
};

export const createBookingHandler: ApiHandler<z.infer<typeof createBody>, undefined> = async ({ body, request }) => {
  const ip = clientIp(request);

  // The cookie flow gates session creation behind a Turnstile check
  // (app/api/booking/session/route.ts); startPublicSession mints a session
  // server-side with no equivalent front door, and /api/v1/* is exempt from
  // the middleware's browser/bot checks. So this endpoint must verify the
  // caller's own captcha token before minting anything — fail closed only
  // when Turnstile is actually configured, so local/dev is unaffected.
  if (isTurnstileConfigured()) {
    const ok = await verifyTurnstileStrict(body.turnstile_token, ip);
    if (!ok) {
      throw new ApiError(403, "insufficient_scope", "Captcha verification failed.");
    }
  }

  const { token } = await startPublicSession({
    appointmentTypeId: body.appointmentTypeId,
    timezone: body.visitorTimezone,
    attribution: body.attribution,
  });

  // Namespace the caller-chosen Idempotency-Key by an IP-derived principal
  // id before it reaches createBooking's dedupe (a GLOBAL select on
  // bookings.idempotency_key — lib/scheduling/booking.ts). Unnamespaced, a
  // guessable key from one caller could return a stranger's booking id and
  // manage_token, which grants PII read + cancel/reschedule access. The
  // cookie route is authenticated by its session cookie already, so its key
  // is left as-is.
  // This isolation boundary trusts clientIp() (lib/security.ts), which
  // reads `x-real-ip`/the rightmost `x-forwarded-for` hop — correct behind
  // Vercel's trusted proxy, but spoofable by any caller that reaches this
  // route directly without going through it.
  const headerKey = request.headers.get("idempotency-key") ?? undefined;
  const idempotencyKey = headerKey ? `pub:${keylessPrincipalId(ip)}:${headerKey}` : undefined;

  const result = await completeBooking({ ...body, sessionToken: token, idempotencyKey });

  if (!result.ok) {
    if (result.status === 401) {
      // Cannot occur for the public path: the session was just created.
      // Mapped defensively so it never leaks as a client-facing error.
      throw new ApiError(500, "internal", "Something went wrong.");
    }
    if (result.code === "paused") {
      throw new ApiError(503, "unavailable", result.error);
    }
    const code =
      result.status === 409
        ? "conflict"
        : result.status === 403
          ? "insufficient_scope"
          : "validation_failed";
    throw new ApiError(result.status, code, result.error, result.code ? { code: result.code } : undefined);
  }

  return {
    status: 201,
    data: {
      booking_id: result.bookingId,
      manage_token: result.manageToken,
      confirmed_url: result.confirmedUrl,
      recommended_plan_key: result.recommendedPlanKey ?? null,
      recommended_plan_name: result.recommendedPlanName ?? null,
    },
  };
};
