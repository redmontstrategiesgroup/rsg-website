import { NextResponse } from "next/server";
import { z } from "zod";
import { processLead } from "@/lib/leads";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import {
  QUALIFICATION_SECTIONS,
  QUALIFIED_THRESHOLD,
  computeQualificationScore,
  qualificationCategory,
} from "@/lib/lifecycle/qualification-content";
import { visibleSections } from "@/lib/lifecycle/form-utils";
import { CATEGORY_APPOINTMENT_SLUGS } from "@/lib/lifecycle/types";
import { createAssessment } from "@/lib/lifecycle/assessments";
import {
  ensureOpportunityForLead,
  onQualificationSubmitted,
} from "@/lib/lifecycle/orchestrate";

export const runtime = "nodejs";

const schema = z.object({
  answers: z.record(z.string(), z.unknown()),
  // Honeypot — real users never fill this.
  company_fax: z.string().optional(),
  attribution: z
    .object({
      pageUrl: z.string().max(500).optional(),
      referrer: z.string().max(500).optional(),
      utmSource: z.string().max(200).optional(),
      utmMedium: z.string().max(200).optional(),
      utmCampaign: z.string().max(200).optional(),
    })
    .optional(),
});

const str = (answers: Record<string, unknown>, key: string, max = 2000): string => {
  const value = answers[key];
  return typeof value === "string" ? value.trim().slice(0, max) : "";
};

export async function POST(request: Request) {
  if (!(await rateLimit(`start:${clientIp(request)}`, 6, 10 * 60_000))) {
    return rateLimitResponse();
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  // Honeypot: pretend success, store nothing.
  if (body.company_fax) {
    return NextResponse.json({ ok: true, next: "book", url: "/book" });
  }

  const answers = body.answers;
  const name = str(answers, "name", 200);
  const businessName = str(answers, "business_name", 200);
  const email = str(answers, "email", 320).toLowerCase();
  const phone = str(answers, "phone", 50);

  if (!name || !businessName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone) {
    return NextResponse.json(
      { error: "Please complete the required contact fields." },
      { status: 400 },
    );
  }

  // Server-side validation of required answers within visible sections.
  for (const section of visibleSections(QUALIFICATION_SECTIONS, answers)) {
    for (const question of section.questions) {
      if (!question.required) continue;
      const value = answers[question.key];
      const answered = Array.isArray(value)
        ? value.length > 0
        : String(value ?? "").trim().length > 0;
      if (!answered) {
        return NextResponse.json(
          { error: `Please answer: ${question.label}` },
          { status: 400 },
        );
      }
    }
  }

  const score = computeQualificationScore(answers);
  const category = qualificationCategory(answers);
  const qualified = score >= QUALIFIED_THRESHOLD;

  const result = await processLead({
    name,
    company: businessName,
    email,
    phone,
    website: str(answers, "website", 300),
    industry: str(answers, "industry", 100),
    problem: str(answers, "main_challenge"),
    improve: str(answers, "desired_outcome"),
    timeline: str(answers, "timeline", 50),
    submittedAt: new Date().toISOString(),
    score,
    source: "website_qualification",
    status: "submitted",
    pageUrl: body.attribution?.pageUrl,
    referrer: body.attribution?.referrer,
    utmSource: body.attribution?.utmSource,
    utmMedium: body.attribution?.utmMedium,
    utmCampaign: body.attribution?.utmCampaign,
  });

  const bookSlug = CATEGORY_APPOINTMENT_SLUGS[category];
  const bookUrl = `/book/${bookSlug}`;

  // Without Supabase (dev without env), the lead is stored locally and the
  // visitor is routed straight to booking — nothing else is possible.
  if (!isSupabaseConfigured() || !result.leadId) {
    return NextResponse.json({ ok: true, next: "book", url: bookUrl });
  }

  // Persist the qualification-only columns the shared pipeline doesn't know.
  try {
    const sb = getSupabase();
    if (sb) {
      await sb
        .from("leads")
        .update({
          service_area: str(answers, "service_area", 200),
          employee_count: str(answers, "team_size", 30),
          revenue_range: str(answers, "revenue_range", 30),
          budget_range: str(answers, "budget_range", 30),
          desired_outcome: str(answers, "desired_outcome"),
          current_systems: str(answers, "current_systems"),
          heard_about: str(answers, "heard_about", 50),
          service_category: category,
          qualification_snapshot: { qualification: answers, score },
          updated_at: new Date().toISOString(),
        })
        .eq("id", result.leadId);
    }
  } catch (error) {
    console.error("[start] lead enrichment failed", error);
  }

  try {
    const lead = { id: result.leadId, name, businessName, email };
    const opportunity = await ensureOpportunityForLead({
      ...lead,
      serviceCategory: category,
    });

    let assessmentToken: string | undefined;
    if (qualified) {
      const assessment = await createAssessment({ leadId: result.leadId, email });
      assessmentToken = assessment.token;
    }

    await onQualificationSubmitted({
      lead,
      opportunity,
      qualified,
      assessmentToken,
      bookSlug,
    });

    if (qualified && assessmentToken) {
      return NextResponse.json({
        ok: true,
        next: "assessment",
        url: `/assessment/${assessmentToken}`,
        bookUrl,
      });
    }
    return NextResponse.json({ ok: true, next: "book", url: bookUrl });
  } catch (error) {
    console.error("[start] lifecycle orchestration failed", error);
    // The lead is saved; the visitor still gets a productive next step.
    return NextResponse.json({ ok: true, next: "book", url: bookUrl });
  }
}
