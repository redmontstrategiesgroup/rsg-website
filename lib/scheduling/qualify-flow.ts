import { z } from "zod";
import {
  computeQualification,
  validateAnswers,
} from "@/lib/scheduling/qualification";
import { getPublishedQualification } from "@/lib/scheduling/catalog";
import { getSessionByToken } from "@/lib/scheduling/sessions";
import { upsertSchedulingLead } from "@/lib/scheduling/leads";
import { requireSupabase, siteUrl } from "@/lib/scheduling/db";
import {
  sendInternalNotification,
  sendTemplatedEmail,
} from "@/lib/scheduling/notifications";
import { trackSchedulingEvent, logActivity } from "@/lib/scheduling/analytics";
import { enqueueWebhook } from "@/lib/scheduling/webhooks";
import type { ContactInfo, QualificationOutcome } from "@/lib/scheduling/types";

const contactSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  businessName: z.string().min(1).max(160),
  email: z.string().email().max(200),
  phone: z.string().min(7).max(40),
  website: z.string().max(300).optional().or(z.literal("")),
  industry: z.string().max(120).optional().or(z.literal("")),
  businessLocation: z.string().max(160).optional().or(z.literal("")),
  employeeCount: z.string().max(40).optional().or(z.literal("")),
  monthlyRevenueRange: z.string().max(60).optional().or(z.literal("")),
  heardAbout: z.string().max(80).optional().or(z.literal("")),
});

export async function runQualification(input: {
  sessionToken: string;
  contact: ContactInfo;
  answers: Record<string, unknown>;
  consent: boolean;
}) {
  if (!input.consent) {
    return { ok: false as const, error: "Consent is required.", code: "consent" };
  }

  const parsed = contactSchema.safeParse(input.contact);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid contact information.", code: "contact" };
  }

  const session = await getSessionByToken(input.sessionToken);
  if (!session) {
    return { ok: false as const, error: "Session expired.", code: "session" };
  }

  const published = await getPublishedQualification();
  if (!published?.ruleSet) {
    return {
      ok: false as const,
      error: "Qualification is not configured.",
      code: "config",
    };
  }

  const missing = validateAnswers(
    published.questions,
    input.answers,
    session.service_id
  );
  if (missing.length) {
    return {
      ok: false as const,
      error: "Please complete all required questions.",
      code: "answers",
      missing,
    };
  }

  const result = computeQualification({
    questions: published.questions,
    ruleSet: published.ruleSet,
    answers: input.answers,
    serviceId: session.service_id,
  });

  const sb = requireSupabase();
  let serviceName = "";
  if (session.service_id) {
    const { data: svc } = await sb
      .from("services")
      .select("name")
      .eq("id", session.service_id)
      .maybeSingle();
    serviceName = svc?.name ?? "";
  }

  const statusMap: Record<QualificationOutcome, string> = {
    qualified: "qualified",
    manual_review: "manual_review",
    not_eligible: "not_eligible",
  };

  const { id: leadId } = await upsertSchedulingLead({
    contact: parsed.data,
    serviceName,
    attribution: (session.attribution ?? {}) as never,
    status: statusMap[result.outcome],
    qualificationScore: result.totalScore,
    qualificationOutcome: result.outcome,
    qualificationSnapshot: {
      breakdown: result.scoreBreakdown,
      ruleHits: result.ruleHits,
      priority: result.priority,
      maxScore: result.maxScore,
    },
    sessionToken: session.token,
    isTest: session.is_test,
    consentAt: new Date().toISOString(),
    answers: input.answers,
  });

  const { data: qualResult } = await sb
    .from("qualification_results")
    .insert({
      lead_id: leadId,
      session_id: session.id,
      rule_set_id: published.ruleSet.id,
      total_score: result.totalScore,
      max_score: result.maxScore,
      outcome: result.outcome,
      priority: result.priority,
      rule_hits: result.ruleHits,
      score_breakdown: result.scoreBreakdown,
    })
    .select("id")
    .single();

  const responseRows = Object.entries(input.answers).map(([key, answer]) => {
    const q = published.questions.find((x) => x.key === key);
    return {
      lead_id: leadId,
      session_id: session.id,
      form_id: published.form.id,
      question_id: q?.id ?? null,
      question_key: key,
      answer: answer as never,
      points_earned: result.scoreBreakdown[key] ?? 0,
    };
  });
  if (responseRows.length) {
    await sb.from("qualification_responses").insert(responseRows);
  }

  await sb.from("consent_records").insert({
    lead_id: leadId,
    session_id: session.id,
    consent_type: "intake_privacy",
    granted: true,
  });

  await sb
    .from("booking_sessions")
    .update({
      contact: parsed.data,
      answers: input.answers,
      lead_id: leadId,
      qualification_outcome: result.outcome,
      qualification_score: result.totalScore,
      qualification_result_id: qualResult?.id ?? null,
      step: result.allowCalendar ? "calendar" : "outcome",
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  await trackSchedulingEvent({
    eventType: "intake_completed",
    sessionId: session.id,
    leadId,
    serviceId: session.service_id ?? undefined,
    isTest: session.is_test,
  });
  await trackSchedulingEvent({
    eventType: `qualification_${result.outcome}`,
    sessionId: session.id,
    leadId,
    isTest: session.is_test,
  });

  await logActivity({
    entityType: "lead",
    entityId: leadId,
    leadId,
    action: "qualification_completed",
    detail: { outcome: result.outcome, score: result.totalScore },
  });

  const vars = {
    first_name: parsed.data.firstName,
    full_name: `${parsed.data.firstName} ${parsed.data.lastName}`,
    business_name: parsed.data.businessName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    website: parsed.data.website ?? "",
    industry: parsed.data.industry ?? "",
    service: serviceName,
    qualification_score: result.totalScore,
    qualification_outcome: result.outcome,
    admin_lead_url: `${siteUrl()}/admin?tab=leads&lead=${leadId}`,
  };

  await sendTemplatedEmail({
    templateKey: "visitor_submission",
    to: parsed.data.email,
    vars,
    leadId,
  });

  await sendInternalNotification("internal_lead_submitted", vars, { leadId });

  if (result.outcome === "manual_review") {
    await sendTemplatedEmail({
      templateKey: "visitor_manual_review",
      to: parsed.data.email,
      vars,
      leadId,
    });
    await sendInternalNotification("internal_manual_review", vars, { leadId });
    await enqueueWebhook(
      "lead.manual_review",
      { leadId, score: result.totalScore },
      { eventId: `lead.manual_review:${leadId}` }
    );
  } else if (result.outcome === "not_eligible") {
    await sendTemplatedEmail({
      templateKey: "visitor_not_eligible",
      to: parsed.data.email,
      vars,
      leadId,
    });
    await sendInternalNotification("internal_not_eligible", vars, { leadId });
    await enqueueWebhook(
      "lead.disqualified",
      { leadId, score: result.totalScore },
      { eventId: `lead.disqualified:${leadId}` }
    );
  } else {
    await enqueueWebhook(
      "lead.qualified",
      { leadId, score: result.totalScore },
      { eventId: `lead.qualified:${leadId}` }
    );
  }

  // Qualification runs once per lead, so the lead id is the identity. If a lead
  // is ever re-qualified in place, add the attempt number here — otherwise the
  // second outcome is deduped away.
  await enqueueWebhook(
    "lead.submitted",
    { leadId, outcome: result.outcome },
    { eventId: `lead.submitted:${leadId}` }
  );

  return {
    ok: true as const,
    outcome: result.outcome,
    allowCalendar: result.allowCalendar,
    message: result.message,
    // Score only returned for test sessions
    score: session.is_test ? result.totalScore : undefined,
    leadId,
  };
}
