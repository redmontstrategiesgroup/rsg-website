import { z } from "zod";
import { intakeAnswersSchema, intakeContactSchema } from "./intake-schema";

/**
 * Zod schemas shared by the cookie booking route (`app/api/booking/create`)
 * and the public booking API (`lib/apiv1/resources/public-booking.ts`).
 * Kept dependency-free (only `zod` and `./intake-schema`, no `@/` alias) so
 * it can be imported by tests without the alias-resolve hook or module
 * mocking.
 */

export const attributionSchema = z.object({
  pageUrl: z.string().max(500).optional(),
  referrer: z.string().max(500).optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
  utmContent: z.string().max(120).optional(),
  utmTerm: z.string().max(120).optional(),
  landingPage: z.string().max(500).optional(),
  deviceType: z.string().max(40).optional(),
});

/**
 * Shared booking-completion payload, minus `sessionToken` (the cookie route
 * and the public route each supply that differently — see
 * `sessionBodySchema` below and `startPublicSession`).
 */
export const bookingBodySchema = z.object({
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

/** Cookie route: session comes from a token the visitor already holds. */
export const sessionBodySchema = bookingBodySchema.extend({
  sessionToken: z.string().min(20).max(200),
});

/**
 * Public API: anonymous callers have no prior session, so `intake` is
 * mandatory (it doubles as how we create one via `startPublicSession`).
 */
export const createBody = bookingBodySchema.extend({
  intake: bookingBodySchema.shape.intake.unwrap(),
  attribution: attributionSchema.optional(),
  // Anonymous callers mint their own session server-side (no Turnstile check
  // on the way in like the cookie session route gets), so the public create
  // endpoint verifies a Turnstile token itself before minting one.
  turnstile_token: z.string().max(4000).optional(),
});
