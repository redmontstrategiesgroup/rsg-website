import { randomUUID } from "node:crypto";
import { requireSupabase, normalizePhone, extractDomain } from "./db";
import type { ContactInfo, Attribution, QualificationOutcome } from "./types";
import { logActivity } from "./analytics";
import {
  recommendPlan,
  sanitizeServicePlanAnswers,
} from "@/lib/managed-services/recommend";

/**
 * Managed-services fields for the lead row, derived from the optional
 * ongoing-support answers. Never throws — a recommendation failure must
 * never break booking.
 */
function servicePlanLeadFields(
  answers: Record<string, unknown> | undefined
): Record<string, unknown> {
  try {
    const sanitized = sanitizeServicePlanAnswers(answers?.servicePlan);
    if (!sanitized) return {};
    const rec = recommendPlan(sanitized);
    return {
      service_plan_answers: sanitized,
      recommended_plan: rec?.planKey ?? null,
    };
  } catch {
    return {};
  }
}

export async function findExistingLead(input: {
  email: string;
  phone?: string;
  website?: string;
}): Promise<{ id: string } | null> {
  const sb = requireSupabase();
  const email = input.email.trim().toLowerCase();
  const phoneNorm = input.phone ? normalizePhone(input.phone) : "";
  const domain = input.website ? extractDomain(input.website) : "";

  const { data: byEmail } = await sb
    .from("leads")
    .select("id")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byEmail) return byEmail;

  if (phoneNorm.length >= 10) {
    const { data: byPhone } = await sb
      .from("leads")
      .select("id")
      .eq("phone_normalized", phoneNorm)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byPhone) return byPhone;
  }

  if (domain) {
    const { data: byDomain } = await sb
      .from("leads")
      .select("id")
      .eq("business_domain", domain)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byDomain) return byDomain;
  }

  return null;
}

export async function upsertSchedulingLead(input: {
  contact: ContactInfo;
  serviceName?: string;
  attribution?: Attribution;
  status: string;
  qualificationScore?: number;
  qualificationOutcome?: QualificationOutcome;
  qualificationSnapshot?: Record<string, unknown>;
  sessionToken?: string;
  isTest?: boolean;
  consentAt?: string;
  answers?: Record<string, unknown>;
}): Promise<{ id: string; created: boolean }> {
  const sb = requireSupabase();
  const existing = await findExistingLead({
    email: input.contact.email,
    phone: input.contact.phone,
    website: input.contact.website,
  });

  const phoneNorm = normalizePhone(input.contact.phone);
  const domain = input.contact.website
    ? extractDomain(input.contact.website)
    : extractDomain(input.contact.email);

  const fullName = `${input.contact.firstName} ${input.contact.lastName}`.trim();
  const problem =
    typeof input.answers?.problem === "string" ? input.answers.problem : "";
  const improve =
    typeof input.answers?.result === "string" ? input.answers.result : "";

  const payload = {
    name: fullName,
    first_name: input.contact.firstName,
    last_name: input.contact.lastName,
    business_name: input.contact.businessName,
    website: input.contact.website ?? "",
    email: input.contact.email.trim().toLowerCase(),
    phone: input.contact.phone,
    phone_normalized: phoneNorm,
    business_domain: domain,
    industry: input.contact.industry ?? "",
    business_location: input.contact.businessLocation ?? "",
    employee_count: input.contact.employeeCount ?? "",
    monthly_revenue_range: input.contact.monthlyRevenueRange ?? "",
    heard_about: input.contact.heardAbout ?? "",
    preferred_contact: input.contact.preferredContact ?? "",
    service_requested: input.serviceName ?? "",
    biggest_problem: problem,
    improvement_goal: improve,
    status: input.status,
    // Only touch qualification fields when the caller supplies them, so the
    // simplified (unscored) intake never wipes an existing lead's history.
    ...(input.qualificationScore !== undefined
      ? {
          lead_score: input.qualificationScore,
          qualification_score: input.qualificationScore,
        }
      : {}),
    ...(input.qualificationOutcome !== undefined
      ? { qualification_outcome: input.qualificationOutcome }
      : {}),
    ...(input.qualificationSnapshot !== undefined
      ? { qualification_snapshot: input.qualificationSnapshot }
      : {}),
    session_token: input.sessionToken ?? null,
    is_test: input.isTest ?? false,
    consent_at: input.consentAt ?? null,
    source: "website_booking_funnel",
    page_url: input.attribution?.pageUrl ?? "",
    referrer: input.attribution?.referrer ?? "",
    utm_source: input.attribution?.utmSource ?? "",
    utm_medium: input.attribution?.utmMedium ?? "",
    utm_campaign: input.attribution?.utmCampaign ?? "",
    utm_content: input.attribution?.utmContent ?? "",
    utm_term: input.attribution?.utmTerm ?? "",
    // Ongoing support & management answers → stored plan recommendation.
    ...servicePlanLeadFields(input.answers),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await sb.from("leads").update(payload).eq("id", existing.id);
    if (error) throw error;
    await logActivity({
      entityType: "lead",
      entityId: existing.id,
      leadId: existing.id,
      action: "lead_updated_from_intake",
      detail: { status: input.status, outcome: input.qualificationOutcome },
    });
    return { id: existing.id, created: false };
  }

  const id = randomUUID();
  const { error } = await sb.from("leads").insert({ id, ...payload });
  if (error) throw error;
  await logActivity({
    entityType: "lead",
    entityId: id,
    leadId: id,
    action: "lead_created_from_intake",
    detail: { status: input.status, outcome: input.qualificationOutcome },
  });
  return { id, created: true };
}

export async function updateLeadStatus(
  leadId: string,
  status: string,
  extra?: Record<string, unknown>
) {
  const sb = requireSupabase();
  const { error } = await sb
    .from("leads")
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", leadId);
  if (error) throw error;
  await logActivity({
    entityType: "lead",
    entityId: leadId,
    leadId,
    action: "status_changed",
    detail: { status },
  });
}
