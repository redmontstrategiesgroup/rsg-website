import { requireSupabase } from "./db";
import { getSessionByToken } from "./sessions";
import { upsertSchedulingLead } from "./leads";
import { trackSchedulingEvent, logActivity } from "./analytics";
import { splitFullName } from "./intake-schema";
import type { IntakeAnswers, IntakeContact } from "./intake-schema";
import type { ContactInfo } from "./types";

export {
  intakeAnswersSchema,
  intakeContactSchema,
  splitFullName,
} from "./intake-schema";
export type { IntakeAnswers, IntakeContact } from "./intake-schema";

/**
 * Simplified booking intake. Unlike the legacy scored qualification, every
 * visitor who completes this step may book — the answers are stored for
 * internal preparation and routing, never to gate the calendar.
 *
 * Persist the visitor's details, record consent, and mark the session as
 * eligible to book. Called from the booking-create route immediately before
 * the booking itself, so a slot conflict never loses the lead.
 */
export async function submitIntake(input: {
  sessionToken: string;
  contact: IntakeContact;
  answers: IntakeAnswers;
  consent: boolean;
}): Promise<
  | { ok: true; leadId: string }
  | { ok: false; error: string; code: string }
> {
  if (!input.consent) {
    return {
      ok: false,
      error: "Please accept the communication consent to continue.",
      code: "consent",
    };
  }

  const session = await getSessionByToken(input.sessionToken);
  if (!session) {
    return {
      ok: false,
      error: "Your booking session expired. Please refresh and try again.",
      code: "session",
    };
  }

  const sb = requireSupabase();
  let serviceName = "";
  let serviceSlug = "";
  if (session.service_id) {
    const { data: svc } = await sb
      .from("services")
      .select("name, slug")
      .eq("id", session.service_id)
      .maybeSingle();
    serviceName = svc?.name ?? "";
    serviceSlug = svc?.slug ?? "";
  }

  const { firstName, lastName } = splitFullName(input.contact.fullName);
  const contact: ContactInfo = {
    firstName,
    lastName,
    businessName: input.contact.businessName,
    email: input.contact.email,
    phone: input.contact.phone,
    website: input.contact.website,
    industry: input.contact.industry,
    employeeCount: input.answers.business_size ?? "",
    preferredContact: input.contact.preferredContact,
  };

  const { id: leadId } = await upsertSchedulingLead({
    contact,
    serviceName,
    attribution: (session.attribution ?? {}) as never,
    status: "submitted",
    qualificationSnapshot: {
      intake: input.answers,
      helpCategory: serviceName,
      helpCategorySlug: serviceSlug,
      notSureYet: serviceSlug === "not-sure",
    },
    sessionToken: session.token,
    isTest: session.is_test,
    consentAt: new Date().toISOString(),
    answers: input.answers as Record<string, unknown>,
  });

  await sb.from("consent_records").insert({
    lead_id: leadId,
    session_id: session.id,
    consent_type: "intake_privacy",
    granted: true,
  });

  // Everyone who completes the simplified intake may book: mark the session
  // qualified so the existing booking-create eligibility gate passes.
  await sb
    .from("booking_sessions")
    .update({
      contact,
      answers: input.answers,
      lead_id: leadId,
      qualification_outcome: "qualified",
      step: "details",
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

  await logActivity({
    entityType: "lead",
    entityId: leadId,
    leadId,
    action: "intake_completed",
    detail: { helpCategory: serviceName || "(none)" },
  });

  return { ok: true, leadId };
}
