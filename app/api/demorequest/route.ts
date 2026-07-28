import { ZodError } from "zod";
import { demoBySlug } from "@/components/demos/data";
import { demoRequestSchema, PREFERRED_CONTACT_LABELS } from "@/lib/demo-request-schema";
import { processLead, scoreLead } from "@/lib/leads";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";

/**
 * "Request this system" submissions from the interactive demo pages.
 *
 * This is the ONLY demo surface that touches the real backend: it creates an
 * admin-portal lead (source: interactive_demo, with the demo context in the
 * snapshot) and emails the RSG inbox. Every other demo interaction stays in
 * the visitor's browser.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!(await rateLimit(`demo-request:${ip}`, 5, 10 * 60_000))) {
    return rateLimitResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  try {
    const input = demoRequestSchema.parse(body);

    // Honeypot tripped — pretend success so bots learn nothing.
    if (input.hp && input.hp.trim().length > 0) {
      return Response.json({ ok: true });
    }

    const config = demoBySlug(input.demoSlug);
    if (!config) {
      return Response.json({ ok: false, error: "Unknown demo." }, { status: 400 });
    }

    const preferredMeeting = [input.preferredDate, input.preferredTime]
      .filter(Boolean)
      .join(" · ");

    const lead: Lead = {
      name: input.name,
      company: input.company,
      email: input.email,
      phone: input.phone,
      website: "",
      industry: config.industry,
      problem:
        input.notes ||
        input.problem ||
        `Requested the ${config.systemName} after using the interactive demo.`,
      improve: input.services.join(", "),
      preferredContact: PREFERRED_CONTACT_LABELS[input.preferredContact],
      bestTime: preferredMeeting,
      timeline: "",
      pageUrl: input.pageUrl ?? `/demos/${config.slug}`,
      source: "interactive_demo",
      status: "new",
      submittedAt: new Date().toISOString(),
      demo: {
        slug: config.slug,
        system: config.systemName,
        businessCategory: config.industry,
        featuresExplored: input.featuresExplored,
        featuresRequested: input.services,
        scenariosRun: input.scenariosRun,
        demoBusinessName: input.demoBusinessName,
        businessSize: input.businessSize,
        preferredDate: input.preferredDate,
        preferredTime: input.preferredTime,
        extras: input.extras,
      },
    };

    // Base score plus a bounded engagement bonus for real demo usage.
    const engagement = Math.min(
      20,
      input.featuresExplored.length * 2 + (input.scenariosRun ?? 0) * 3
    );
    lead.score = Math.min(100, scoreLead(lead) + 20 + engagement);

    const result = await processLead(lead);
    if (!result.storedLocally && !result.storedRemotely && !result.emailed) {
      return Response.json(
        { ok: false, error: "We couldn't save your request — please try again or email us directly." },
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
    console.error("[demo-request] failed", err);
    return Response.json(
      { ok: false, error: "Something went wrong — please try again." },
      { status: 500 }
    );
  }
}
