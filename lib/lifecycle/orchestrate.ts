import { firstNameOf, links, nowIso, requireSupabase } from "@/lib/lifecycle/core";
import type {
  Assessment,
  Contract,
  Invoice,
  Milestone,
  MonthlyReport,
  OpportunityStage,
  Proposal,
  Questionnaire,
  ResponsibleParty,
  SalesOpportunity,
  ServiceCategory,
  Ticket,
  TrainingAssignment,
  TrainingItem,
} from "@/lib/lifecycle/types";
import {
  MILESTONE_STATUS_LABELS,
  SERVICE_CATEGORY_LABELS,
  formatCents,
} from "@/lib/lifecycle/types";
import { fireAutomation } from "@/lib/lifecycle/automations";
import { logClientActivity } from "@/lib/lifecycle/activity";
import { createQuestionnaire } from "@/lib/lifecycle/questionnaires";
import { templateForCategory } from "@/lib/lifecycle/questionnaire-content";
import {
  expireDueProposals,
  findProposalsExpiringSoon,
  getProposal,
  recordProposalEvent,
} from "@/lib/lifecycle/proposals";
import {
  findContractsNeedingSignatureReminder,
  markContractReminded,
} from "@/lib/lifecycle/contracts";
import {
  createInvoice,
  findInvoicesNeedingReminder,
  formatInvoiceNumber,
  listInvoices,
  markInvoiceReminded,
} from "@/lib/lifecycle/billing";
import { createProject, listProjects } from "@/lib/lifecycle/projects";
import { provisionClientForOpportunity } from "@/lib/lifecycle/access";
import {
  findQuestionnairesNeedingReminder,
  markQuestionnaireReminded,
} from "@/lib/lifecycle/questionnaires";
import { findDueRenewalReminders, markRenewalReminded } from "@/lib/lifecycle/growth";
import { findInactiveTickets } from "@/lib/lifecycle/support";
import { processDueAutomationRuns } from "@/lib/lifecycle/automations";
import { sendInternalNotification, sendTemplatedEmail } from "@/lib/scheduling/notifications";
import { updateLeadStatus } from "@/lib/scheduling/leads";

/**
 * Cross-stage orchestration. Each on* handler is called at the mutation site
 * (API route or admin action) and:
 *   1. advances the sales opportunity (the journey spine),
 *   2. fires the right automations (dedupe-keyed — safe to call twice),
 *   3. writes portal-visible activity.
 * Nothing here throws for notification failures; the primary mutation always
 * wins and side effects degrade to logged errors.
 */

// ---------------------------------------------------------------------------
// Sales opportunities (journey spine CRUD)
// ---------------------------------------------------------------------------

export async function createOpportunity(input: {
  leadId?: string | null;
  clientId?: string | null;
  assessmentId?: string | null;
  name: string;
  serviceCategory?: string;
  stage?: OpportunityStage;
  valueCents?: number | null;
  ownerAdminId?: string | null;
}): Promise<SalesOpportunity> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("sales_opportunities")
    .insert({
      lead_id: input.leadId ?? null,
      client_id: input.clientId ?? null,
      assessment_id: input.assessmentId ?? null,
      name: input.name.trim(),
      service_category: input.serviceCategory ?? "",
      stage: input.stage ?? "qualification",
      value_cents: input.valueCents ?? null,
      owner_admin_id: input.ownerAdminId ?? null,
      updated_at: nowIso(),
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create opportunity: ${error?.message ?? "no row returned"}`);
  }
  return data as SalesOpportunity;
}

export async function getOpportunity(id: string): Promise<SalesOpportunity | null> {
  const sb = requireSupabase();
  const { data } = await sb
    .from("sales_opportunities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as SalesOpportunity | null) ?? null;
}

export async function listOpportunities(filters: {
  stage?: OpportunityStage;
  clientId?: string;
  leadId?: string;
  limit?: number;
} = {}): Promise<SalesOpportunity[]> {
  const sb = requireSupabase();
  let query = sb
    .from("sales_opportunities")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(filters.limit ?? 100);
  if (filters.stage) query = query.eq("stage", filters.stage);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.leadId) query = query.eq("lead_id", filters.leadId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list opportunities: ${error.message}`);
  return (data ?? []) as SalesOpportunity[];
}

export async function updateOpportunity(
  id: string,
  patch: {
    stage?: OpportunityStage;
    name?: string;
    serviceCategory?: string;
    valueCents?: number | null;
    ownerAdminId?: string | null;
    clientId?: string | null;
    assessmentId?: string | null;
    nextAction?: string | null;
    nextActionDue?: string | null;
    nextActionParty?: ResponsibleParty;
    consultationNotes?: string;
    internalReview?: Record<string, unknown>;
    lostReason?: string | null;
  },
): Promise<SalesOpportunity> {
  const sb = requireSupabase();
  const row: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.stage !== undefined) row.stage = patch.stage;
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.serviceCategory !== undefined) row.service_category = patch.serviceCategory;
  if (patch.valueCents !== undefined) row.value_cents = patch.valueCents;
  if (patch.ownerAdminId !== undefined) row.owner_admin_id = patch.ownerAdminId;
  if (patch.clientId !== undefined) row.client_id = patch.clientId;
  if (patch.assessmentId !== undefined) row.assessment_id = patch.assessmentId;
  if (patch.nextAction !== undefined) row.next_action = patch.nextAction;
  if (patch.nextActionDue !== undefined) row.next_action_due = patch.nextActionDue;
  if (patch.nextActionParty !== undefined) row.next_action_party = patch.nextActionParty;
  if (patch.consultationNotes !== undefined) row.consultation_notes = patch.consultationNotes;
  if (patch.internalReview !== undefined) row.internal_review = patch.internalReview;
  if (patch.lostReason !== undefined) row.lost_reason = patch.lostReason;

  const { data, error } = await sb
    .from("sales_opportunities")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to update opportunity: ${error?.message ?? "no row returned"}`);
  }
  return data as SalesOpportunity;
}

export async function ensureOpportunityForLead(lead: {
  id: string;
  name: string;
  businessName: string;
  email: string;
  serviceCategory?: string;
}): Promise<SalesOpportunity> {
  const existing = await listOpportunities({ leadId: lead.id, limit: 10 });
  const active = existing.find((o) => o.stage !== "lost" && o.stage !== "dormant");
  if (active) return active;
  return createOpportunity({
    leadId: lead.id,
    name: lead.businessName || lead.name,
    serviceCategory: lead.serviceCategory ?? "",
  });
}

// ---------------------------------------------------------------------------
// Stage handlers
// ---------------------------------------------------------------------------

function categoryLabel(category: string | null | undefined): string {
  if (!category) return "your goals";
  return SERVICE_CATEGORY_LABELS[category as ServiceCategory] ?? "your goals";
}

export async function onQualificationSubmitted(input: {
  lead: { id: string; name: string; businessName: string; email: string };
  opportunity: SalesOpportunity;
  qualified: boolean;
  assessmentToken?: string;
  bookSlug?: string;
}): Promise<void> {
  const first = firstNameOf(input.lead.name);
  const nextStepUrl = input.qualified
    ? input.assessmentToken
      ? links.assessment(input.assessmentToken)
      : links.book(input.bookSlug)
    : `${links.book()}`;
  const nextStepLabel = input.qualified
    ? input.assessmentToken
      ? "Start your Business Systems Assessment"
      : "Book your consultation"
    : "Book a conversation when the time is right";
  const nextStepLine = input.qualified
    ? "Based on what you shared, the next step is a short Business Systems Assessment — it gives our team a clear picture before we talk."
    : "We work with a limited number of businesses at a time. The most useful next step is a short conversation about where you are today — no commitment, and you'll leave with practical direction either way.";

  await fireAutomation({
    key: "qualification_confirmation",
    dedupeKey: `qualification_confirmation:${input.lead.id}`,
    entityType: "lead",
    entityId: input.lead.id,
    email: {
      to: input.lead.email,
      leadId: input.lead.id,
      vars: {
        first_name: first,
        business_name: input.lead.businessName,
        next_step_line: nextStepLine,
        next_step_url: nextStepUrl,
        next_step_label: nextStepLabel,
      },
    },
    inApp: {
      audience: "admin",
      title: `New qualification: ${input.lead.businessName}`,
      body: input.qualified ? "Qualified — assessment invited." : "Routed to alternative path.",
      href: links.admin("pipeline"),
    },
  });

  if (input.assessmentToken) {
    await fireAutomation({
      key: "assessment_invite",
      dedupeKey: `assessment_invite:${input.lead.id}`,
      entityType: "lead",
      entityId: input.lead.id,
      email: {
        to: input.lead.email,
        leadId: input.lead.id,
        vars: {
          first_name: first,
          business_name: input.lead.businessName,
          assessment_url: links.assessment(input.assessmentToken),
        },
      },
    });
    await updateOpportunity(input.opportunity.id, {
      stage: "assessment",
      nextAction: "Complete the Business Systems Assessment",
      nextActionParty: "client",
      nextActionDue: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    });
  }
}

export async function notifyLeadAssigned(input: {
  leadId: string;
  businessName: string;
  fullName: string;
  email: string;
  serviceCategory?: string;
  score?: number | null;
  ownerAdminId: string;
}): Promise<void> {
  await fireAutomation({
    key: "lead_assignment",
    dedupeKey: `lead_assignment:${input.leadId}:${input.ownerAdminId}`,
    entityType: "lead",
    entityId: input.leadId,
    internalEmail: {
      vars: {
        business_name: input.businessName,
        full_name: input.fullName,
        email: input.email,
        service_category: categoryLabel(input.serviceCategory),
        score: String(input.score ?? "—"),
        admin_url: links.admin("pipeline"),
      },
    },
    inApp: {
      audience: "admin",
      title: `Lead assigned: ${input.businessName}`,
      href: links.admin("pipeline"),
    },
  });
}

export async function onAssessmentSubmitted(
  assessment: Assessment,
  lead: { id: string; name: string; businessName: string; email: string } | null,
): Promise<SalesOpportunity | null> {
  let opportunity: SalesOpportunity | null = null;
  if (lead) {
    opportunity = await ensureOpportunityForLead({
      ...lead,
      serviceCategory: assessment.recommended_service_category ?? undefined,
    });
    opportunity = await updateOpportunity(opportunity.id, {
      stage: "assessment",
      assessmentId: assessment.id,
      serviceCategory:
        assessment.recommended_service_category ?? opportunity.service_category,
      nextAction: "Book your consultation",
      nextActionParty: "client",
      nextActionDue: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    });
    try {
      await updateLeadStatus(lead.id, "qualified");
    } catch (error) {
      console.error("onAssessmentSubmitted: lead status update failed", error);
    }
  }

  await fireAutomation({
    key: "assessment_complete_internal",
    dedupeKey: `assessment_complete_internal:${assessment.id}`,
    entityType: "assessment",
    entityId: assessment.id,
    internalEmail: {
      vars: {
        full_name: lead?.name ?? assessment.email,
        business_name: lead?.businessName ?? assessment.email,
        email: assessment.email,
        score: String(assessment.score ?? "—"),
        recommended_category: categoryLabel(assessment.recommended_service_category),
        admin_url: links.admin("assessments"),
      },
    },
    inApp: {
      audience: "admin",
      title: `Assessment completed — ${lead?.businessName ?? assessment.email}`,
      body: `Score ${assessment.score ?? "—"} · ${categoryLabel(assessment.recommended_service_category)}`,
      href: links.admin("assessments"),
    },
  });
  return opportunity;
}

export async function onBookingCreated(input: {
  bookingId: string;
  leadId?: string | null;
  email: string;
  name: string;
  businessName?: string;
  appointmentTimeLocal?: string;
  appointmentStartsAt?: string | null;
  serviceCategory?: string | null;
}): Promise<{ questionnaire: Questionnaire }> {
  const templateKey = templateForCategory(input.serviceCategory);
  const questionnaire = await createQuestionnaire({
    bookingId: input.bookingId,
    leadId: input.leadId ?? null,
    templateKey,
    dueAt: input.appointmentStartsAt ?? null,
  });

  if (input.leadId) {
    try {
      const opportunity = await ensureOpportunityForLead({
        id: input.leadId,
        name: input.name,
        businessName: input.businessName ?? input.name,
        email: input.email,
        serviceCategory: input.serviceCategory ?? undefined,
      });
      await updateOpportunity(opportunity.id, {
        stage: "preparation",
        nextAction: "Complete the preparation questionnaire",
        nextActionParty: "client",
        nextActionDue: input.appointmentStartsAt ?? null,
      });
    } catch (error) {
      console.error("onBookingCreated: opportunity update failed", error);
    }
  }

  await fireAutomation({
    key: "questionnaire_invite",
    dedupeKey: `questionnaire_invite:${questionnaire.id}`,
    entityType: "questionnaire",
    entityId: questionnaire.id,
    email: {
      to: input.email,
      leadId: input.leadId ?? undefined,
      bookingId: input.bookingId,
      vars: {
        first_name: firstNameOf(input.name),
        appointment_time_local: input.appointmentTimeLocal ?? "your consultation",
        questionnaire_url: links.questionnaire(questionnaire.token),
      },
    },
  });
  return { questionnaire };
}

export async function onQuestionnaireSubmitted(
  questionnaire: Questionnaire,
  contact: { name?: string; businessName?: string; appointmentTimeAdmin?: string },
): Promise<void> {
  await fireAutomation({
    key: "prep_brief_internal",
    dedupeKey: `prep_brief_internal:${questionnaire.id}`,
    entityType: "questionnaire",
    entityId: questionnaire.id,
    internalEmail: {
      vars: {
        full_name: contact.name ?? "",
        business_name: contact.businessName ?? "",
        appointment_time_admin: contact.appointmentTimeAdmin ?? "upcoming",
        admin_url: links.admin("questionnaires"),
      },
    },
    inApp: {
      audience: "admin",
      title: `Prep brief ready — ${contact.businessName || contact.name || "prospect"}`,
      href: links.admin("questionnaires"),
    },
  });

  if (questionnaire.lead_id) {
    try {
      const opportunities = await listOpportunities({ leadId: questionnaire.lead_id, limit: 5 });
      const active = opportunities.find((o) => o.stage !== "lost");
      if (active) {
        await updateOpportunity(active.id, {
          nextAction: "Hold consultation and complete internal review",
          nextActionParty: "rsg",
        });
      }
    } catch (error) {
      console.error("onQuestionnaireSubmitted: opportunity update failed", error);
    }
  }
}

export async function onProposalSent(
  proposal: Proposal,
  recipient: { email: string; name: string },
): Promise<void> {
  if (proposal.opportunity_id) {
    await updateOpportunity(proposal.opportunity_id, {
      stage: "proposal",
      valueCents: proposal.total_cents,
      nextAction: "Review and approve the proposal",
      nextActionParty: "client",
      nextActionDue: proposal.expires_at,
    }).catch((error) => console.error("onProposalSent: opportunity update failed", error));
  }
  await fireAutomation({
    key: "proposal_delivery",
    dedupeKey: `proposal_delivery:${proposal.id}:v${proposal.version}`,
    entityType: "proposal",
    entityId: proposal.id,
    email: {
      to: recipient.email,
      leadId: proposal.lead_id ?? undefined,
      vars: {
        first_name: firstNameOf(recipient.name),
        proposal_title: proposal.title,
        proposal_url: links.proposal(proposal.token),
        expires_on: proposal.expires_at
          ? new Date(proposal.expires_at).toLocaleDateString("en-US", { dateStyle: "long" })
          : "the date shown in the proposal",
      },
    },
  });
  // Follow-up nudge rides the automation delay (default 3 days) and is
  // silently skipped by dedupe if re-sent; the cron executes it when due.
  await fireAutomation({
    key: "proposal_follow_up",
    dedupeKey: `proposal_follow_up:${proposal.id}:v${proposal.version}`,
    entityType: "proposal",
    entityId: proposal.id,
    email: {
      to: recipient.email,
      leadId: proposal.lead_id ?? undefined,
      vars: {
        first_name: firstNameOf(recipient.name),
        business_name: proposal.title,
        proposal_url: links.proposal(proposal.token),
      },
    },
  });
}

export async function onProposalApproved(proposal: Proposal): Promise<void> {
  if (proposal.opportunity_id) {
    await updateOpportunity(proposal.opportunity_id, {
      stage: "contract",
      valueCents: proposal.total_cents,
      nextAction: "Prepare and send the agreement",
      nextActionParty: "rsg",
      nextActionDue: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    }).catch((error) => console.error("onProposalApproved: opportunity update failed", error));
  }
  // Internal notice is not a registry automation (always on): direct send.
  try {
    await sendInternalNotification("lc_proposal_approved_internal", {
      approver_name: proposal.approved_by_name ?? "The client",
      proposal_title: proposal.title,
      business_name: proposal.title,
      total: formatCents(proposal.total_cents),
      deposit: formatCents(proposal.deposit_cents),
      admin_url: links.admin("proposals"),
    });
  } catch (error) {
    console.error("onProposalApproved: internal notice failed", error);
  }
  await logClientActivity({
    clientId: proposal.client_id ?? undefined,
    actorType: "client",
    actorName: proposal.approved_by_name ?? "Client",
    action: `Approved proposal "${proposal.title}"`,
    entityType: "proposal",
    entityId: proposal.id,
  });
}

export async function onContractSent(
  contract: Contract,
  recipient: { email: string; name: string },
): Promise<void> {
  await fireAutomation({
    key: "contract_delivery",
    dedupeKey: `contract_delivery:${contract.id}:v${contract.version}`,
    entityType: "contract",
    entityId: contract.id,
    email: {
      to: recipient.email,
      leadId: contract.lead_id ?? undefined,
      vars: {
        first_name: firstNameOf(recipient.name),
        contract_title: contract.title,
        contract_url: links.contract(contract.token),
      },
    },
  });
}

/**
 * All required signatures are in → create the deposit invoice from the
 * approved proposal and request payment. Idempotent per contract.
 */
export async function onContractExecuted(
  contract: Contract,
  signer: { email: string; name: string },
): Promise<{ invoice: Invoice | null }> {
  if (contract.opportunity_id) {
    await updateOpportunity(contract.opportunity_id, {
      stage: "deposit",
      nextAction: "Pay the project deposit",
      nextActionParty: "client",
      nextActionDue: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    }).catch((error) => console.error("onContractExecuted: opportunity update failed", error));
  }

  // Signed-copy confirmation to the client (always on, not a setting).
  try {
    await sendTemplatedEmail({
      templateKey: "lc_contract_signed",
      to: signer.email,
      vars: {
        first_name: firstNameOf(signer.name),
        contract_title: contract.title,
        contract_url: links.contract(contract.token),
        next_step_line: "your project deposit — the secure payment link is on its way.",
      },
      leadId: contract.lead_id ?? undefined,
    });
  } catch (error) {
    console.error("onContractExecuted: signed-copy email failed", error);
  }

  await fireAutomation({
    key: "contract_signed_internal",
    dedupeKey: `contract_signed_internal:${contract.id}`,
    entityType: "contract",
    entityId: contract.id,
    internalEmail: {
      vars: {
        contract_title: contract.title,
        business_name: contract.title,
        admin_url: links.admin("contracts"),
      },
    },
    inApp: {
      audience: "admin",
      title: `Fully signed: ${contract.title}`,
      href: links.admin("contracts"),
    },
  });

  // Deposit invoice from the linked proposal (skip when none or zero).
  let invoice: Invoice | null = null;
  const existing = contract.id
    ? (await listInvoices({ kind: "deposit", limit: 200 })).find(
        (inv) => inv.contract_id === contract.id,
      )
    : undefined;
  if (existing) {
    invoice = existing;
  } else if (contract.proposal_id) {
    const loaded = await getProposal(contract.proposal_id);
    if (loaded && loaded.proposal.deposit_cents > 0) {
      invoice = await createInvoice({
        clientId: contract.client_id ?? undefined,
        opportunityId: contract.opportunity_id ?? undefined,
        contractId: contract.id,
        kind: "deposit",
        description: `Project deposit — ${loaded.proposal.title}`,
        lineItems: [
          {
            label: "Project deposit",
            detail: loaded.proposal.title,
            quantity: 1,
            unit_cents: loaded.proposal.deposit_cents,
          },
        ],
        dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        createdBy: "system",
      });
    }
  }

  if (invoice) {
    await fireAutomation({
      key: "deposit_request",
      dedupeKey: `deposit_request:${invoice.id}`,
      entityType: "invoice",
      entityId: invoice.id,
      email: {
        to: signer.email,
        leadId: contract.lead_id ?? undefined,
        vars: {
          first_name: firstNameOf(signer.name),
          amount: formatCents(invoice.total_cents),
          total: formatCents(
            contract.proposal_id
              ? ((await getProposal(contract.proposal_id))?.proposal.total_cents ??
                  invoice.total_cents)
              : invoice.total_cents,
          ),
          pay_url: links.pay(invoice.token),
        },
      },
    });
  }
  return { invoice };
}

/**
 * Deposit paid → the big activation: client account, portal, project,
 * onboarding tasks, welcome email. Idempotent: re-delivered webhooks re-enter
 * safely (provisioning finds the existing client; project creation is guarded).
 */
export async function onInvoicePaid(
  invoice: Invoice,
  payer: { email: string; name: string },
): Promise<{ clientId: string | null; projectId: string | null }> {
  // Receipts go out for every paid invoice.
  await fireAutomation({
    key: "payment_receipt",
    dedupeKey: `payment_receipt:${invoice.id}`,
    entityType: "invoice",
    entityId: invoice.id,
    email: {
      to: payer.email,
      vars: {
        first_name: firstNameOf(payer.name),
        amount: formatCents(invoice.amount_paid_cents || invoice.total_cents),
        description: invoice.description || `Invoice ${formatInvoiceNumber(invoice.number)}`,
        next_step_line:
          invoice.kind === "deposit"
            ? "Your client portal is being activated — a welcome email with your first steps follows shortly."
            : "A record of this payment is available in your client portal.",
      },
    },
  });

  if (invoice.kind !== "deposit") {
    return { clientId: invoice.client_id, projectId: invoice.project_id };
  }

  const opportunity = invoice.opportunity_id
    ? await getOpportunity(invoice.opportunity_id)
    : null;
  const proposal =
    invoice.contract_id || opportunity
      ? (await listInvoicesProposal(invoice)) ?? null
      : null;

  // 1. Client account + portal.
  const provision = await provisionClientForOpportunity({
    businessName: opportunity?.name ?? payer.name,
    contactName: payer.name,
    email: payer.email,
    leadId: opportunity?.lead_id ?? null,
  });
  const clientId = provision.client.id;

  // 2. Link the journey spine + lead.
  if (opportunity) {
    await updateOpportunity(opportunity.id, {
      stage: "won",
      clientId,
      nextAction: "Complete onboarding in the client portal",
      nextActionParty: "client",
    }).catch((error) => console.error("onInvoicePaid: opportunity update failed", error));
    if (opportunity.lead_id) {
      try {
        await updateLeadStatus(opportunity.lead_id, "won");
      } catch (error) {
        console.error("onInvoicePaid: lead status update failed", error);
      }
    }
  }
  const sb = requireSupabase();
  await sb
    .from("invoices")
    .update({ client_id: clientId, updated_at: nowIso() })
    .eq("id", invoice.id);

  // 3. Project (idempotent per opportunity).
  let projectId: string | null = null;
  const existingProjects = opportunity
    ? (await listProjects({ limit: 500 })).filter(
        (p) => p.opportunity_id === opportunity.id,
      )
    : [];
  if (existingProjects.length > 0) {
    projectId = existingProjects[0].id;
  } else {
    const { project } = await createProject({
      clientId,
      opportunityId: opportunity?.id ?? null,
      contractId: invoice.contract_id ?? null,
      name: proposal?.title ?? `${opportunity?.name ?? payer.name} — Systems Project`,
      summary: proposal
        ? `Engagement created from approved proposal "${proposal.title}".`
        : "",
    });
    projectId = project.id;
    await logClientActivity({
      clientId,
      projectId,
      actorType: "system",
      action: "Project created and onboarding started",
      entityType: "project",
      entityId: projectId,
    });
  }

  // 4. Welcome email — with a set-password link for brand-new accounts.
  const portalLine = provision.ownerInvite
    ? links.invite(provision.ownerInvite.token)
    : links.portal();
  await fireAutomation({
    key: "portal_activation",
    dedupeKey: `portal_activation:${clientId}:${invoice.id}`,
    entityType: "client",
    entityId: clientId,
    email: {
      to: payer.email,
      vars: {
        first_name: firstNameOf(payer.name),
        portal_url: portalLine,
        next_step_line:
          "a short onboarding checklist — brand assets, access confirmations, and your kickoff scheduling.",
      },
    },
    inApp: {
      audience: "admin",
      title: `Deposit paid — ${opportunity?.name ?? payer.name}`,
      body: "Portal activated and project created.",
      href: links.admin("clients"),
    },
  });

  await logClientActivity({
    clientId,
    actorType: "system",
    action: `Deposit received (${formatCents(invoice.total_cents)}) — portal activated`,
    entityType: "invoice",
    entityId: invoice.id,
  });
  return { clientId, projectId };
}

async function listInvoicesProposal(invoice: Invoice): Promise<Proposal | null> {
  if (!invoice.opportunity_id) return null;
  const sb = requireSupabase();
  const { data } = await sb
    .from("lifecycle_proposals")
    .select("*")
    .eq("opportunity_id", invoice.opportunity_id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Proposal | null) ?? null;
}

export async function onPaymentFailed(
  invoice: Invoice,
  payer: { email: string; name: string },
  reason: string,
): Promise<void> {
  await fireAutomation({
    key: "payment_failed",
    dedupeKey: `payment_failed:${invoice.id}:${Date.now() >> 16}`,
    entityType: "invoice",
    entityId: invoice.id,
    email: {
      to: payer.email,
      vars: {
        first_name: firstNameOf(payer.name),
        description: invoice.description || `Invoice ${formatInvoiceNumber(invoice.number)}`,
        pay_url: links.pay(invoice.token),
      },
    },
    inApp: {
      audience: "admin",
      title: `Payment failed — ${formatInvoiceNumber(invoice.number)}`,
      body: reason,
      href: links.admin("billing"),
    },
  });
}

// ---------------------------------------------------------------------------
// Delivery-phase handlers
// ---------------------------------------------------------------------------

export async function onMilestoneStatusChanged(input: {
  milestone: Milestone;
  projectName: string;
  previousStatus: string;
  client: { id: string; email: string; name: string } | null;
  note?: string;
}): Promise<void> {
  const { milestone, client } = input;
  if (!client || milestone.status === input.previousStatus) return;
  const statusLabel = MILESTONE_STATUS_LABELS[milestone.status] ?? milestone.status;
  const base = {
    entityType: "milestone",
    entityId: milestone.id,
  };
  const vars = {
    first_name: firstNameOf(client.name),
    milestone_name: milestone.name,
    status_label: statusLabel,
    note: input.note ?? "",
    portal_url: links.portal(),
  };

  if (milestone.status === "delayed" || milestone.status === "blocked") {
    await fireAutomation({
      key: "project_delay_notice",
      dedupeKey: `project_delay_notice:${milestone.id}:${milestone.status}`,
      ...base,
      email: { to: client.email, vars },
      inApp: {
        audience: "client",
        clientId: client.id,
        title: `Schedule update: ${milestone.name}`,
        body: input.note ?? "The timeline for this milestone has shifted.",
        href: "/portal/project",
      },
    });
  } else if (
    milestone.status === "under_review" &&
    milestone.approval_required
  ) {
    await fireAutomation({
      key: "approval_request",
      dedupeKey: `approval_request:${milestone.id}:v${milestone.updated_at}`,
      ...base,
      email: {
        to: client.email,
        vars: {
          ...vars,
          approval_title: milestone.name,
          due_line: milestone.target_date
            ? ` by ${new Date(milestone.target_date).toLocaleDateString("en-US", { dateStyle: "long" })}`
            : "",
        },
      },
      inApp: {
        audience: "client",
        clientId: client.id,
        title: `Your approval is requested: ${milestone.name}`,
        href: "/portal/project",
      },
    });
  } else {
    await fireAutomation({
      key: "milestone_update",
      dedupeKey: `milestone_update:${milestone.id}:${milestone.status}`,
      ...base,
      email: { to: client.email, vars },
      inApp: {
        audience: "client",
        clientId: client.id,
        title: `${milestone.name} — ${statusLabel}`,
        href: "/portal/project",
      },
    });
  }

  await logClientActivity({
    clientId: client.id,
    projectId: milestone.project_id,
    actorType: "admin",
    action: `Milestone "${milestone.name}" moved to ${statusLabel}`,
    entityType: "milestone",
    entityId: milestone.id,
  });
}

export async function onTicketCreated(
  ticket: Ticket,
  client: { id: string; name: string; email: string; businessName: string },
): Promise<void> {
  const slaLine = ticket.target_response_minutes
    ? `We aim to respond within ${
        ticket.target_response_minutes >= 60
          ? `${Math.round(ticket.target_response_minutes / 60)} hour${ticket.target_response_minutes >= 120 ? "s" : ""}`
          : `${ticket.target_response_minutes} minutes`
      }.`
    : "We'll get back to you shortly.";
  await fireAutomation({
    key: "ticket_created",
    dedupeKey: `ticket_created:${ticket.id}`,
    entityType: "ticket",
    entityId: ticket.id,
    email: {
      to: client.email,
      vars: {
        first_name: firstNameOf(client.name),
        ticket_number: String(ticket.number),
        subject: ticket.subject,
        sla_line: slaLine,
        portal_url: `${links.portal()}/support`,
      },
    },
    internalEmail: {
      vars: {
        ticket_number: String(ticket.number),
        subject: ticket.subject,
        priority: ticket.priority,
        business_name: client.businessName,
        admin_url: links.admin("tickets"),
      },
    },
    inApp: {
      audience: "admin",
      title: `New ${ticket.priority} ticket #${ticket.number}: ${ticket.subject}`,
      href: links.admin("tickets"),
    },
  });
}

export async function onTicketUpdated(
  ticket: Ticket,
  client: { id: string; name: string; email: string },
  input: { qualifier: string; note: string },
): Promise<void> {
  await fireAutomation({
    key: "ticket_updated",
    dedupeKey: `ticket_updated:${ticket.id}:${input.qualifier}`,
    entityType: "ticket",
    entityId: ticket.id,
    email: {
      to: client.email,
      vars: {
        first_name: firstNameOf(client.name),
        ticket_number: String(ticket.number),
        subject: ticket.subject,
        note: input.note,
        portal_url: `${links.portal()}/support`,
      },
    },
    inApp: {
      audience: "client",
      clientId: client.id,
      title: `Update on ticket #${ticket.number}`,
      body: input.note,
      href: "/portal/support",
    },
  });
}

export async function onTicketResolved(
  ticket: Ticket,
  client: { id: string; name: string; email: string },
): Promise<void> {
  await fireAutomation({
    key: "ticket_resolved",
    dedupeKey: `ticket_resolved:${ticket.id}:${ticket.resolved_at ?? ""}`,
    entityType: "ticket",
    entityId: ticket.id,
    email: {
      to: client.email,
      vars: {
        first_name: firstNameOf(client.name),
        ticket_number: String(ticket.number),
        subject: ticket.subject,
        resolution: ticket.resolution_notes ?? "",
        portal_url: `${links.portal()}/support`,
      },
    },
    inApp: {
      audience: "client",
      clientId: client.id,
      title: `Ticket #${ticket.number} resolved`,
      href: "/portal/support",
    },
  });
}

export async function onReportPublished(
  report: MonthlyReport,
  client: { id: string; name: string; email: string },
  periodLabelText: string,
): Promise<void> {
  await fireAutomation({
    key: "report_published",
    dedupeKey: `report_published:${report.id}`,
    entityType: "report",
    entityId: report.id,
    email: {
      to: client.email,
      vars: {
        first_name: firstNameOf(client.name),
        period_label: periodLabelText,
        portal_url: `${links.portal()}/reports`,
      },
    },
    inApp: {
      audience: "client",
      clientId: client.id,
      title: `Your ${periodLabelText} performance report is ready`,
      href: "/portal/reports",
    },
  });
  await logClientActivity({
    clientId: client.id,
    actorType: "admin",
    action: `Published the ${periodLabelText} performance report`,
    entityType: "report",
    entityId: report.id,
  });
}

export async function onTrainingAssigned(
  assignment: TrainingAssignment,
  item: TrainingItem,
  client: { id: string; name: string; email: string },
): Promise<void> {
  await fireAutomation({
    key: "training_assigned",
    dedupeKey: `training_assigned:${assignment.id}`,
    entityType: "training_assignment",
    entityId: assignment.id,
    email: {
      to: client.email,
      vars: {
        first_name: firstNameOf(client.name),
        training_title: item.title,
        required_line: assignment.required ? " as required training for your team" : "",
        portal_url: `${links.portal()}/training`,
      },
    },
    inApp: {
      audience: "client",
      clientId: client.id,
      title: `New training: ${item.title}`,
      href: "/portal/training",
    },
  });
}

// ---------------------------------------------------------------------------
// Cron sweep
// ---------------------------------------------------------------------------

type SweepCounts = Record<string, number>;

async function sweep(
  counts: SweepCounts,
  name: string,
  fn: () => Promise<number>,
): Promise<void> {
  try {
    counts[name] = await fn();
  } catch (error) {
    counts[name] = -1;
    counts.errors = (counts.errors ?? 0) + 1;
    console.error(`runLifecycleCron: ${name} failed`, error);
  }
}

/**
 * Time-based automation sweeps. Rides the existing 5-minute cron. Every
 * outbound nudge is dedupe-keyed so overlapping cron runs cannot double-send.
 */
export async function runLifecycleCron(): Promise<SweepCounts> {
  const counts: SweepCounts = { errors: 0 };

  await sweep(counts, "due_runs", async () => {
    const result = await processDueAutomationRuns(25);
    return result.processed;
  });

  await sweep(counts, "proposals_expired", () => expireDueProposals());

  await sweep(counts, "proposals_expiring_notice", async () => {
    const expiring = await findProposalsExpiringSoon(3);
    let sent = 0;
    for (const proposal of expiring) {
      const loaded = await getProposal(proposal.id);
      const email = await proposalRecipientEmail(proposal);
      if (!email) continue;
      const result = await fireAutomation({
        key: "proposal_expiring",
        dedupeKey: `proposal_expiring:${proposal.id}`,
        entityType: "proposal",
        entityId: proposal.id,
        email: {
          to: email.email,
          vars: {
            first_name: firstNameOf(email.name),
            proposal_title: loaded?.proposal.title ?? proposal.title,
            proposal_url: links.proposal(proposal.token),
            expires_on: proposal.expires_at
              ? new Date(proposal.expires_at).toLocaleDateString("en-US", {
                  dateStyle: "long",
                })
              : "soon",
          },
        },
      });
      if (result.status === "completed" || result.status === "queued") {
        await recordProposalEvent(proposal.id, "reminder_sent", { actor: "system" });
        sent += 1;
      }
    }
    return sent;
  });

  await sweep(counts, "questionnaire_reminders", async () => {
    const due = await findQuestionnairesNeedingReminder({
      olderThanMinutes: 48 * 60,
      maxReminders: 2,
    });
    let sent = 0;
    for (const questionnaire of due) {
      const contact = await leadContact(questionnaire.lead_id);
      if (!contact) continue;
      const result = await fireAutomation({
        key: "questionnaire_reminder",
        dedupeKey: `questionnaire_reminder:${questionnaire.id}:r${questionnaire.reminder_count + 1}`,
        entityType: "questionnaire",
        entityId: questionnaire.id,
        email: {
          to: contact.email,
          leadId: questionnaire.lead_id ?? undefined,
          vars: {
            first_name: firstNameOf(contact.name),
            appointment_time_local: questionnaire.due_at
              ? new Date(questionnaire.due_at).toLocaleString("en-US", {
                  dateStyle: "long",
                  timeStyle: "short",
                })
              : "your upcoming consultation",
            questionnaire_url: links.questionnaire(questionnaire.token),
          },
        },
      });
      if (result.status === "completed" || result.status === "queued") {
        await markQuestionnaireReminded(questionnaire.id);
        sent += 1;
      }
    }
    return sent;
  });

  await sweep(counts, "signature_reminders", async () => {
    const due = await findContractsNeedingSignatureReminder({
      olderThanMinutes: 48 * 60,
      maxReminders: 2,
    });
    let sent = 0;
    for (const contract of due) {
      const signerEmail = await contractSignerEmail(contract.id);
      if (!signerEmail) continue;
      const result = await fireAutomation({
        key: "signature_reminder",
        dedupeKey: `signature_reminder:${contract.id}:${new Date().toISOString().slice(0, 10)}`,
        entityType: "contract",
        entityId: contract.id,
        email: {
          to: signerEmail.email,
          vars: {
            first_name: firstNameOf(signerEmail.name),
            contract_title: contract.title,
            contract_url: links.contract(contract.token),
          },
        },
      });
      if (result.status === "completed" || result.status === "queued") {
        await markContractReminded(contract.id);
        sent += 1;
      }
    }
    return sent;
  });

  await sweep(counts, "payment_reminders", async () => {
    const due = await findInvoicesNeedingReminder({
      olderThanMinutes: 72 * 60,
      maxReminders: 3,
    });
    let sent = 0;
    for (const invoice of due) {
      const contact = await invoiceContact(invoice);
      if (!contact) continue;
      const result = await fireAutomation({
        key: "payment_reminder",
        dedupeKey: `payment_reminder:${invoice.id}:r${invoice.reminder_count + 1}`,
        entityType: "invoice",
        entityId: invoice.id,
        email: {
          to: contact.email,
          vars: {
            first_name: firstNameOf(contact.name),
            invoice_number: formatInvoiceNumber(invoice.number),
            amount: formatCents(invoice.total_cents - invoice.amount_paid_cents),
            due_on: invoice.due_at
              ? new Date(invoice.due_at).toLocaleDateString("en-US", { dateStyle: "long" })
              : "now",
            pay_url: links.pay(invoice.token),
          },
        },
      });
      if (result.status === "completed" || result.status === "queued") {
        await markInvoiceReminded(invoice.id);
        sent += 1;
      }
    }
    return sent;
  });

  await sweep(counts, "renewal_reminders", async () => {
    const due = await findDueRenewalReminders();
    let sent = 0;
    for (const { renewal, daysOut } of due) {
      const contact = await clientContact(renewal.client_id);
      if (!contact) continue;
      const result = await fireAutomation({
        key: "renewal_reminder",
        dedupeKey: `renewal_reminder:${renewal.id}:d${daysOut}`,
        entityType: "renewal",
        entityId: renewal.id,
        email: {
          to: contact.email,
          vars: {
            first_name: firstNameOf(contact.name),
            renewal_name: renewal.name,
            renews_on: new Date(renewal.renews_on).toLocaleDateString("en-US", {
              dateStyle: "long",
            }),
          },
        },
        inApp: {
          audience: "admin",
          title: `Renewal in ${daysOut} days: ${renewal.name}`,
          href: links.admin("renewals"),
        },
      });
      if (result.status === "completed" || result.status === "queued") {
        await markRenewalReminded(renewal.id);
        sent += 1;
      }
    }
    return sent;
  });

  await sweep(counts, "ticket_inactive_nudges", async () => {
    const inactive = await findInactiveTickets({ inactiveMinutes: 72 * 60 });
    let sent = 0;
    for (const ticket of inactive) {
      const contact = await clientContact(ticket.client_id);
      if (!contact) continue;
      const result = await fireAutomation({
        key: "ticket_inactive_nudge",
        dedupeKey: `ticket_inactive_nudge:${ticket.id}:${new Date().toISOString().slice(0, 10)}`,
        entityType: "ticket",
        entityId: ticket.id,
        email: {
          to: contact.email,
          vars: {
            first_name: firstNameOf(contact.name),
            ticket_number: String(ticket.number),
            subject: ticket.subject,
            note: "This ticket is waiting on a reply from your side — it will stay open, and any details you can add help us resolve it faster.",
            portal_url: `${links.portal()}/support`,
          },
        },
      });
      if (result.status === "completed" || result.status === "queued") sent += 1;
    }
    return sent;
  });

  return counts;
}

// ---------------------------------------------------------------------------
// Contact lookups (small, tolerant helpers for the sweeps)
// ---------------------------------------------------------------------------

async function leadContact(
  leadId: string | null,
): Promise<{ name: string; email: string } | null> {
  if (!leadId) return null;
  const sb = requireSupabase();
  const { data } = await sb
    .from("leads")
    .select("name, email")
    .eq("id", leadId)
    .maybeSingle();
  if (!data?.email) return null;
  return { name: String(data.name ?? ""), email: String(data.email) };
}

async function clientContact(
  clientId: string | null,
): Promise<{ name: string; email: string } | null> {
  if (!clientId) return null;
  const sb = requireSupabase();
  const { data } = await sb
    .from("clients")
    .select("name, email")
    .eq("id", clientId)
    .maybeSingle();
  if (!data?.email) return null;
  return { name: String(data.name ?? ""), email: String(data.email) };
}

async function proposalRecipientEmail(
  proposal: Proposal,
): Promise<{ name: string; email: string } | null> {
  return (
    (await leadContact(proposal.lead_id)) ?? (await clientContact(proposal.client_id))
  );
}

/** Who pays this invoice — client contact first, then the opportunity's lead. */
export async function invoiceContact(
  invoice: Invoice,
): Promise<{ name: string; email: string } | null> {
  return (
    (await clientContact(invoice.client_id)) ??
    (invoice.opportunity_id
      ? await (async () => {
          const opp = await getOpportunity(invoice.opportunity_id as string);
          return opp ? leadContact(opp.lead_id) : null;
        })()
      : null)
  );
}

async function contractSignerEmail(
  contractId: string,
): Promise<{ name: string; email: string } | null> {
  const sb = requireSupabase();
  const { data } = await sb
    .from("contract_signatures")
    .select("signer_name, signer_email, signed_at")
    .eq("contract_id", contractId)
    .eq("signer_type", "client")
    .is("signed_at", null)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.signer_email) return null;
  return { name: String(data.signer_name ?? ""), email: String(data.signer_email) };
}
