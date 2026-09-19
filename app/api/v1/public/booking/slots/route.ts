import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { listSlots, slotsQuery } from "@/lib/apiv1/resources/public-booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "none",
  rateLimit: { limit: 120, windowMs: 600_000 },
  query: slotsQuery,
  meta: { operationId: "listBookingSlots", summary: "List available booking slots", tag: "Public Booking", response: z.any() },
}, listSlots);

export const OPTIONS = options;
