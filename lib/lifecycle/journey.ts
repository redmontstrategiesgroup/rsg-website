import { links } from "@/lib/lifecycle/core";
import type {
  Assessment,
  Contract,
  Invoice,
  JourneyStep,
  Project,
  Proposal,
  Questionnaire,
  ResponsibleParty,
  SalesOpportunity,
} from "@/lib/lifecycle/types";
import { CATEGORY_APPOINTMENT_SLUGS, type ServiceCategory } from "@/lib/lifecycle/types";

/**
 * Pure computation of the client-facing journey. Given whatever artifacts
 * exist for an opportunity, produce the ordered step list with status,
 * next action, responsible party, deadline, and deep link. Unit-testable —
 * no I/O.
 */

export type JourneyInput = {
  opportunity: SalesOpportunity | null;
  assessment?: Assessment | null;
  booking?: { starts_at: string; status?: string } | null;
  questionnaire?: Questionnaire | null;
  proposal?: Proposal | null;
  contract?: Contract | null;
  depositInvoice?: Invoice | null;
  project?: Project | null;
};

function bookSlugFor(opportunity: SalesOpportunity | null): string | undefined {
  const category = opportunity?.service_category as ServiceCategory | "";
  if (category && category in CATEGORY_APPOINTMENT_SLUGS) {
    return CATEGORY_APPOINTMENT_SLUGS[category as ServiceCategory];
  }
  return undefined;
}

export function computeJourneySteps(input: JourneyInput): JourneyStep[] {
  const {
    opportunity,
    assessment,
    booking,
    questionnaire,
    proposal,
    contract,
    depositInvoice,
    project,
  } = input;

  const assessmentDone =
    assessment?.status === "submitted" || assessment?.status === "reviewed";
  const bookingDone = Boolean(booking && booking.status !== "cancelled");
  const consultationHeld =
    bookingDone && new Date(booking!.starts_at).getTime() < Date.now();
  const questionnaireDone =
    questionnaire?.status === "submitted" || questionnaire?.status === "waived";
  const proposalApproved = proposal?.status === "approved";
  const contractExecuted =
    contract?.status === "countersigned" ||
    contract?.status === "active" ||
    (contract?.status === "signed" && contract.requires_countersign === false);
  const depositPaid = depositInvoice?.status === "paid";
  const projectActive = Boolean(project);

  type Def = {
    key: string;
    label: string;
    done: boolean;
    /** Present only while this step is the current one. */
    action?: {
      next_action: string;
      responsible: ResponsibleParty;
      due?: string | null;
      href?: string | null;
    };
    /** A step that never happened and was passed by (e.g. no assessment). */
    skipped?: boolean;
  };

  const defs: Def[] = [
    {
      key: "qualification",
      label: "Qualification",
      done: Boolean(opportunity) || assessmentDone || bookingDone,
      action: {
        next_action: "Tell us about your business",
        responsible: "client",
        href: `${links.portal().replace("/portal", "")}/start`,
      },
    },
    {
      key: "assessment",
      label: "Business Systems Assessment",
      done: assessmentDone,
      skipped: !assessment && (bookingDone || Boolean(proposal)),
      action: {
        next_action: "Complete your assessment",
        responsible: "client",
        due: assessment?.expires_at ?? null,
        href: assessment ? links.assessment(assessment.token) : null,
      },
    },
    {
      key: "booking",
      label: "Consultation booked",
      done: bookingDone,
      action: {
        next_action: "Book your consultation",
        responsible: "client",
        href: links.book(bookSlugFor(opportunity)),
      },
    },
    {
      key: "preparation",
      label: "Preparation",
      done: questionnaireDone,
      skipped: !questionnaire && consultationHeld,
      action: {
        next_action: "Complete the preparation questionnaire",
        responsible: "client",
        due: questionnaire?.due_at ?? null,
        href: questionnaire ? links.questionnaire(questionnaire.token) : null,
      },
    },
    {
      key: "consultation",
      label: "Consultation",
      done: consultationHeld,
      action: {
        next_action: "Attend your consultation",
        responsible: "joint",
        due: booking?.starts_at ?? null,
      },
    },
    {
      key: "proposal",
      label: "Proposal",
      done: proposalApproved,
      action: proposal
        ? {
            next_action:
              proposal.status === "revision_requested"
                ? "We're revising your proposal"
                : "Review and approve your proposal",
            responsible:
              proposal.status === "revision_requested" ? "rsg" : "client",
            due: proposal.expires_at,
            href: links.proposal(proposal.token),
          }
        : {
            next_action: "We're preparing your proposal",
            responsible: "rsg",
            due: opportunity?.next_action_due ?? null,
          },
    },
    {
      key: "contract",
      label: "Agreement",
      done: contractExecuted,
      action: contract
        ? {
            next_action: "Review and sign your agreement",
            responsible: contract.status === "signed" ? "rsg" : "client",
            due: contract.expires_at,
            href: links.contract(contract.token),
          }
        : {
            next_action: "We're preparing your agreement",
            responsible: "rsg",
          },
    },
    {
      key: "deposit",
      label: "Deposit",
      done: depositPaid,
      action: depositInvoice
        ? {
            next_action: "Pay your project deposit",
            responsible: "client",
            due: depositInvoice.due_at,
            href: links.pay(depositInvoice.token),
          }
        : {
            next_action: "Your deposit invoice is on its way",
            responsible: "rsg",
          },
    },
    {
      key: "portal",
      label: "Portal & onboarding",
      done: projectActive && project!.status !== "onboarding",
      action: {
        next_action: projectActive
          ? "Complete your onboarding checklist"
          : "Your portal is being prepared",
        responsible: projectActive ? "client" : "rsg",
        href: projectActive ? links.portal() : null,
      },
    },
    {
      key: "delivery",
      label: "Project delivery",
      done: Boolean(
        project &&
          ["launched", "support", "completed"].includes(project.status),
      ),
      action: {
        next_action: "Follow progress on your project roadmap",
        responsible: "joint",
        href: projectActive ? `${links.portal()}/project` : null,
      },
    },
  ];

  // First not-done, not-skipped step is current; everything after is upcoming.
  let currentAssigned = false;
  return defs.map((def): JourneyStep => {
    if (def.done) {
      return { key: def.key, label: def.label, status: "complete" };
    }
    if (def.skipped && !currentAssigned) {
      return { key: def.key, label: def.label, status: "skipped" };
    }
    if (!currentAssigned) {
      currentAssigned = true;
      return {
        key: def.key,
        label: def.label,
        status: "current",
        next_action: def.action?.next_action,
        responsible: def.action?.responsible,
        due: def.action?.due ?? null,
        href: def.action?.href ?? null,
      };
    }
    return { key: def.key, label: def.label, status: "upcoming" };
  });
}

export function summarizeNextAction(steps: JourneyStep[]): {
  label: string;
  responsible: ResponsibleParty;
  href: string | null;
  due: string | null;
} | null {
  const current = steps.find((s) => s.status === "current");
  if (!current?.next_action) return null;
  return {
    label: current.next_action,
    responsible: current.responsible ?? "rsg",
    href: current.href ?? null,
    due: current.due ?? null,
  };
}
