// lib/apiv1/resources/public-booking.ts
import { z } from "zod";
import { DateTime } from "luxon";
import { ApiError } from "../errors";
import { completeBooking, startPublicSession } from "@/lib/scheduling/book-flow";
import { createBody } from "@/lib/scheduling/book-flow-schema";
import { getAvailableSlots } from "@/lib/scheduling/slots";
import { getSettings } from "@/lib/scheduling/notifications";
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
  const { token } = await startPublicSession({
    appointmentTypeId: body.appointmentTypeId,
    timezone: body.visitorTimezone,
    attribution: body.attribution,
  });

  const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;
  const result = await completeBooking({ ...body, sessionToken: token, idempotencyKey });

  if (!result.ok) {
    const code =
      result.status === 409
        ? "conflict"
        : result.status === 403
          ? "insufficient_scope"
          : "validation_failed";
    if (result.status === 401) {
      // Cannot occur for the public path: the session was just created.
      // Mapped defensively so it never leaks as a client-facing error.
      throw new ApiError(500, "internal", "Something went wrong.");
    }
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
