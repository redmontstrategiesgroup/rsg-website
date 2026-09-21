import { BookingCreatedSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { createBody, createBookingHandler } from "@/lib/apiv1/resources/public-booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api("POST", {
  auth: "none",
  idempotent: true,
  rateLimit: { limit: 10, windowMs: 3_600_000 },
  body: createBody,
  meta: { operationId: "createBooking", summary: "Create a booking", tag: "Public Booking", response: envelope(BookingCreatedSchema), status: 201 },
}, createBookingHandler);

export const OPTIONS = options;
