import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  createBookingSession,
  getSessionByToken,
  patchBookingSession,
} from "@/lib/scheduling/sessions";
import { SchedulingUnavailableError } from "@/lib/scheduling/db";

export const runtime = "nodejs";

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return true;
  if (!secret) return false;
  if (!token) return false;
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: ip,
      }),
    }
  );
  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}

const startSchema = z.object({
  turnstileToken: z.string().max(4000).optional(),
  timezone: z.string().max(80).optional(),
  serviceId: z.string().uuid().optional(),
  appointmentTypeId: z.string().uuid().optional(),
  isTest: z.boolean().optional(),
  attribution: z
    .object({
      pageUrl: z.string().max(500).optional(),
      referrer: z.string().max(500).optional(),
      utmSource: z.string().max(120).optional(),
      utmMedium: z.string().max(120).optional(),
      utmCampaign: z.string().max(120).optional(),
      utmContent: z.string().max(120).optional(),
      utmTerm: z.string().max(120).optional(),
      landingPage: z.string().max(500).optional(),
      deviceType: z.string().max(40).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Scheduling is temporarily unavailable." },
      { status: 503 }
    );
  }

  const ip = clientIp(request);
  if (!(await rateLimit(`booking-session:${ip}`, 20, 10 * 60 * 1000))) {
    return rateLimitResponse();
  }

  try {
    const body = startSchema.parse(await request.json());
    if (!(await verifyTurnstile(body.turnstileToken ?? "", ip))) {
      return NextResponse.json(
        { error: "Bot check failed. Please refresh and try again." },
        { status: 400 }
      );
    }

    // Only allow isTest from admin-authenticated callers — ignore from public
    const session = await createBookingSession({
      attribution: body.attribution,
      timezone: body.timezone,
      serviceId: body.serviceId,
      appointmentTypeId: body.appointmentTypeId,
      isTest: false,
    });

    return NextResponse.json({
      token: session.token,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    if (err instanceof SchedulingUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    console.error("[booking/session]", err);
    return NextResponse.json({ error: "Unable to start session." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Scheduling is temporarily unavailable." },
      { status: 503 }
    );
  }

  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const ip = clientIp(request);
  if (!(await rateLimit(`booking-session-get:${ip}`, 60, 60 * 1000))) {
    return rateLimitResponse();
  }

  const session = await getSessionByToken(token);
  if (!session) {
    return NextResponse.json({ error: "Session not found or expired." }, { status: 404 });
  }

  // Public-safe projection — no internal scores unless test
  return NextResponse.json({
    token: session.token,
    step: session.step,
    serviceId: session.service_id,
    appointmentTypeId: session.appointment_type_id,
    contact: session.contact,
    answers: session.answers,
    qualificationOutcome: session.qualification_outcome,
    allowCalendar: session.qualification_outcome === "qualified",
    timezone: session.timezone,
    meetingFormat: session.meeting_format,
    expiresAt: session.expires_at,
  });
}

const patchSchema = z.object({
  token: z.string().min(20).max(200),
  step: z.string().max(40).optional(),
  serviceId: z.string().uuid().nullable().optional(),
  appointmentTypeId: z.string().uuid().nullable().optional(),
  contact: z.record(z.string(), z.unknown()).optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
  timezone: z.string().max(80).optional(),
  meetingFormat: z.string().max(40).optional(),
});

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Scheduling is temporarily unavailable." },
      { status: 503 }
    );
  }

  const ip = clientIp(request);
  if (!(await rateLimit(`booking-session-patch:${ip}`, 60, 10 * 60 * 1000))) {
    return rateLimitResponse();
  }

  try {
    const body = patchSchema.parse(await request.json());
    const updated = await patchBookingSession(body.token, {
      step: body.step,
      serviceId: body.serviceId,
      appointmentTypeId: body.appointmentTypeId,
      contact: body.contact as never,
      answers: body.answers,
      timezone: body.timezone,
      meetingFormat: body.meetingFormat,
    });
    if (!updated) {
      return NextResponse.json({ error: "Session not found or expired." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, step: updated.step });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    console.error("[booking/session PATCH]", err);
    return NextResponse.json({ error: "Unable to save progress." }, { status: 500 });
  }
}
