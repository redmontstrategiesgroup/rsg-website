import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import { runQualification } from "@/lib/scheduling/qualify-flow";

export const runtime = "nodejs";

const schema = z.object({
  sessionToken: z.string().min(20).max(200),
  contact: z.object({
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    businessName: z.string().min(1).max(160),
    email: z.string().email().max(200),
    phone: z.string().min(7).max(40),
    website: z.string().max(300).optional(),
    industry: z.string().max(120).optional(),
    businessLocation: z.string().max(160).optional(),
    employeeCount: z.string().max(40).optional(),
    monthlyRevenueRange: z.string().max(60).optional(),
    heardAbout: z.string().max(80).optional(),
  }),
  answers: z.record(z.string(), z.unknown()),
  consent: z.boolean(),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Scheduling is temporarily unavailable." },
      { status: 503 }
    );
  }

  const ip = clientIp(request);
  if (!(await rateLimit(`booking-qualify:${ip}`, 10, 10 * 60 * 1000))) {
    return rateLimitResponse();
  }

  try {
    const body = schema.parse(await request.json());
    const result = await runQualification(body);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code, missing: "missing" in result ? result.missing : undefined },
        { status: 400 }
      );
    }
    return NextResponse.json({
      outcome: result.outcome,
      allowCalendar: result.allowCalendar,
      message: result.message,
      score: result.score,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    console.error("[booking/qualify]", err);
    return NextResponse.json(
      { error: "Unable to evaluate eligibility." },
      { status: 500 }
    );
  }
}
