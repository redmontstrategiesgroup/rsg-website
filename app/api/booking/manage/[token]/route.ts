import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  cancelBooking,
  calendarLinksForBooking,
  getBookingByManageToken,
  rescheduleBooking,
} from "@/lib/scheduling/booking";
import { formatInZone } from "@/lib/scheduling/availability";
import { getAvailableSlots } from "@/lib/scheduling/slots";
import { DateTime } from "luxon";
import { requireSupabase } from "@/lib/scheduling/db";
import { trackSchedulingEvent } from "@/lib/scheduling/analytics";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: Request, ctx: Ctx) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Scheduling is temporarily unavailable." },
      { status: 503 }
    );
  }

  const { token } = await ctx.params;
  const ip = clientIp(request);
  if (!(await rateLimit(`booking-manage-get:${ip}:${token.slice(0, 8)}`, 30, 60 * 1000))) {
    return rateLimitResponse();
  }

  const booking = await getBookingByManageToken(token);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const lead = booking.leads as Record<string, string> | null;
  const type = booking.appointment_types as {
    name?: string;
    public_description?: string;
    duration_minutes?: number;
  } | null;

  const links = calendarLinksForBooking(booking);

  return NextResponse.json({
    id: booking.id,
    status: booking.status,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
    visitorTimezone: booking.visitor_timezone,
    meetingFormat: booking.meeting_format,
    meetingLocation: booking.meeting_location,
    appointmentType: type?.name,
    description: type?.public_description,
    durationMinutes: type?.duration_minutes,
    displayTime: formatInZone(booking.starts_at, booking.visitor_timezone),
    contact: {
      name: lead?.name,
      email: lead?.email,
      phone: lead?.phone,
      businessName: lead?.business_name,
    },
    calendarLinks: links,
    canReschedule: booking.status !== "cancelled",
    canCancel: booking.status !== "cancelled",
    appointmentTypeId: booking.appointment_type_id,
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cancel"),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("reschedule"),
    startsAt: z.string().min(10).max(40),
    visitorTimezone: z.string().max(80).optional(),
  }),
  z.object({
    action: z.literal("slots"),
    from: z.string().optional(),
    to: z.string().optional(),
    timezone: z.string().max(80).optional(),
  }),
  z.object({
    action: z.literal("update_contact"),
    phone: z.string().max(40).optional(),
  }),
]);

export async function POST(request: Request, ctx: Ctx) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Scheduling is temporarily unavailable." },
      { status: 503 }
    );
  }

  const { token } = await ctx.params;
  const ip = clientIp(request);
  if (!(await rateLimit(`booking-manage-post:${ip}`, 20, 10 * 60 * 1000))) {
    return rateLimitResponse();
  }

  try {
    const body = actionSchema.parse(await request.json());
    const booking = await getBookingByManageToken(token);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (body.action === "cancel") {
      const result = await cancelBooking({
        manageToken: token,
        reason: body.reason,
        actor: "visitor",
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code },
          { status: 400 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "reschedule") {
      const result = await rescheduleBooking({
        manageToken: token,
        startsAt: body.startsAt,
        visitorTimezone: body.visitorTimezone,
        actor: "visitor",
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code },
          { status: result.code === "conflict" ? 409 : 400 }
        );
      }
      await trackSchedulingEvent({
        eventType: "reschedule",
        bookingId: booking.id,
        leadId: booking.lead_id,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "slots") {
      const tz = body.timezone || booking.visitor_timezone || "America/New_York";
      const from =
        body.from || DateTime.now().setZone(tz).toISODate()!;
      const to =
        body.to || DateTime.fromISO(from).plus({ days: 14 }).toISODate()!;
      const slots = await getAvailableSlots({
        appointmentTypeId: booking.appointment_type_id,
        from,
        to,
        visitorTimezone: tz,
        teamMemberId: booking.team_member_id,
      });
      return NextResponse.json({ slots, from, to });
    }

    if (body.action === "update_contact") {
      if (body.phone && booking.lead_id) {
        const sb = requireSupabase();
        await sb
          .from("leads")
          .update({ phone: body.phone, updated_at: new Date().toISOString() })
          .eq("id", booking.lead_id);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    console.error("[booking/manage]", err);
    return NextResponse.json({ error: "Unable to update booking." }, { status: 500 });
  }
}
