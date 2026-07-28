import { z, ZodError } from "zod";
import { getVertical } from "@/lib/industries/store";
import { VERTICAL_SLUGS, type VerticalSlug } from "@/lib/industries/types";
import { processLead, scoreLead } from "@/lib/leads";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";

const assessmentSchema = z.object({
  vertical: z.enum(VERTICAL_SLUGS as [string, ...string[]]),
  answers: z.record(z.string().max(120), z.string().max(400)).refine(
    (a) => Object.keys(a).length <= 24,
    { message: "Too many answers." }
  ),
  contact: z.object({
    name: z.string().trim().min(2).max(120),
    company: z.string().trim().max(200).optional().default(""),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().max(40).optional().default(""),
  }),
  recommendedSystemId: z.string().trim().max(80).optional(),
  pageUrl: z.string().trim().max(300).optional(),
  hp: z.string().max(200).optional(),
});

/**
 * Industry assessment submissions. Creates an admin-portal lead
 * (source: industry_assessment) carrying the visitor's answers and the
 * system recommendation they were shown, then emails the RSG inbox.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!(await rateLimit(`assessment:${ip}`, 5, 10 * 60_000))) {
    return rateLimitResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  try {
    const input = assessmentSchema.parse(body);

    // Honeypot tripped — pretend success so bots learn nothing.
    if (input.hp && input.hp.trim().length > 0) {
      return Response.json({ ok: true });
    }

    const vertical = await getVertical(input.vertical as VerticalSlug);
    const recommended = vertical.systems.find((s) => s.id === input.recommendedSystemId);
    const bottleneck =
      input.answers.bottleneck ?? Object.values(input.answers).slice(-1)[0] ?? "";

    const answerLines = vertical.assessment.questions
      .map((q) => {
        const a = input.answers[q.id];
        return a ? `${q.label}: ${a}` : null;
      })
      .filter(Boolean)
      .join("\n");

    const lead: Lead = {
      name: input.contact.name,
      company: input.contact.company,
      email: input.contact.email,
      phone: input.contact.phone,
      website: "",
      industry: vertical.name,
      problem: bottleneck
        ? `Biggest bottleneck: ${bottleneck}\n\n${answerLines}`
        : answerLines || `Completed the ${vertical.shortName} assessment.`,
      improve: recommended
        ? `Recommended starting point shown: ${recommended.name}`
        : `Completed the ${vertical.shortName} assessment.`,
      preferredContact: "",
      bestTime: "",
      timeline: "",
      pageUrl: input.pageUrl ?? `/industries/${vertical.slug}`,
      source: "industry_assessment",
      status: "new",
      submittedAt: new Date().toISOString(),
    };

    // Assessments are high-intent: full qualification answers up front.
    lead.score = Math.min(100, scoreLead(lead) + 25);

    const result = await processLead(lead);
    if (!result.storedLocally && !result.storedRemotely && !result.emailed) {
      return Response.json(
        { ok: false, error: "We couldn't save your assessment — please try again or email us directly." },
        { status: 500 }
      );
    }

    return Response.json({ ok: true, duplicate: result.duplicate });
  } catch (err) {
    if (err instanceof ZodError) {
      return Response.json(
        { ok: false, error: err.issues[0]?.message ?? "Please check the form and try again." },
        { status: 400 }
      );
    }
    console.error("[assessment] failed", err);
    return Response.json(
      { ok: false, error: "Something went wrong — please try again." },
      { status: 500 }
    );
  }
}
