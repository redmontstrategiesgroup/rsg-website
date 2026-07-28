/**
 * Electronic contract templates.
 *
 * Plain-English starting points for every agreement kind in the lifecycle.
 * Placeholders ({{client_business}}, {{effective_date}}, …) are substituted
 * by fillContractSections() when a contract is created. Every template ends
 * with a clearly labeled note stating that the document is a template and
 * should be reviewed by the client's own attorney.
 */

import {
  CONTRACT_KIND_LABELS,
  type ContractKind,
  type ContractSection,
} from "@/lib/lifecycle/types";

export type ContractAcknowledgment = { key: string; label: string };

export type ContractTemplate = {
  kind: ContractKind;
  label: string;
  sections: ContractSection[];
  acknowledgments: ContractAcknowledgment[];
};

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

function parties(kind: ContractKind): ContractSection {
  return {
    key: "parties",
    title: "Parties and Effective Date",
    body:
      `This ${CONTRACT_KIND_LABELS[kind]} (the "Agreement") is made as of ` +
      `{{effective_date}} between Redmont Strategies Group ("RSG") and ` +
      `{{client_business}} (the "Client"), represented by {{client_name}}. ` +
      `RSG and the Client are together the "Parties."`,
  };
}

const TERM: ContractSection = {
  key: "term",
  title: "Term",
  body:
    "This Agreement takes effect on {{effective_date}} and continues for " +
    "{{term_length}}, unless it is ended earlier under the Termination " +
    "section below.",
};

const PAYMENT: ContractSection = {
  key: "payment_terms",
  title: "Payment Terms",
  body:
    "The total investment under this Agreement is {{total_investment}}. A " +
    "deposit of {{deposit}} is due before work begins, and the remaining " +
    "balance follows this schedule:\n\n{{payment_schedule}}\n\nAll amounts " +
    "are in U.S. dollars. Invoices are due on receipt unless the invoice " +
    "states a later date. If an invoice is more than fifteen (15) days past " +
    "due, RSG may pause work until the account is brought current. Paused " +
    "work may reasonably shift delivery dates.",
};

const CONFIDENTIALITY: ContractSection = {
  key: "confidentiality",
  title: "Confidentiality",
  body:
    "While working together, each Party may learn non-public information " +
    "about the other's business — including customers, pricing, finances, " +
    "processes, systems, and plans. Each Party agrees to use the other's " +
    "confidential information only for this engagement, to protect it with " +
    "at least reasonable care, and not to share it with anyone who does not " +
    "need it for the engagement, except where disclosure is required by " +
    "law. Information that is already public, already known before " +
    "disclosure, or independently developed is not confidential " +
    "information. These obligations survive the end of this Agreement.",
};

const INTELLECTUAL_PROPERTY: ContractSection = {
  key: "intellectual_property",
  title: "Intellectual Property",
  body:
    "Once the Client has paid in full, the Client owns the final " +
    "deliverables created specifically for {{client_business}} under this " +
    "Agreement. RSG keeps ownership of its pre-existing tools, templates, " +
    "frameworks, and know-how, and grants the Client a perpetual, " +
    "non-exclusive license to use them as they are embedded in the " +
    "deliverables. Third-party software, platforms, and services remain " +
    "subject to their own license terms, and any recurring third-party " +
    "fees are the Client's responsibility unless stated otherwise in the " +
    "payment schedule.",
};

const WARRANTIES: ContractSection = {
  key: "warranties_limitations",
  title: "Warranties and Limitations",
  body:
    "RSG will perform the services in a professional and workmanlike " +
    "manner, consistent with industry practice. Beyond that commitment, " +
    'the services and deliverables are provided "as is": RSG does not ' +
    "guarantee specific business outcomes such as revenue, search " +
    "rankings, or lead volume, because those depend on factors outside " +
    "RSG's control. Neither Party is liable to the other for indirect, " +
    "incidental, or consequential damages. Each Party's total liability " +
    "under this Agreement is limited to the amounts the Client paid RSG " +
    "under this Agreement in the twelve (12) months before the claim " +
    "arose. These limits do not apply to breaches of confidentiality or " +
    "to either Party's willful misconduct.",
};

const TERMINATION: ContractSection = {
  key: "termination",
  title: "Termination",
  body:
    "Either Party may end this Agreement with fourteen (14) days' written " +
    "notice. If that happens, the Client pays for all work completed and " +
    "for non-cancelable costs incurred through the end date, and RSG " +
    "delivers all completed, paid-for work product. Either Party may end " +
    "this Agreement immediately if the other materially breaches it and " +
    "does not fix the breach within ten (10) days of written notice. " +
    "Sections that by their nature should continue — payment obligations, " +
    "confidentiality, intellectual property, and limitations of liability " +
    "— survive termination.",
};

const GOVERNING_LAW: ContractSection = {
  key: "governing_law",
  title: "Governing Law",
  body:
    "This Agreement is governed by the laws of the Commonwealth of " +
    "Massachusetts, without regard to its conflict-of-law rules. Any " +
    "dispute the Parties cannot resolve informally will be brought in the " +
    "state or federal courts located in Massachusetts, and each Party " +
    "consents to the jurisdiction of those courts.",
};

const ELECTRONIC_SIGNATURE: ContractSection = {
  key: "electronic_signatures",
  title: "Electronic Signatures",
  body:
    "The Parties agree that this Agreement may be reviewed and signed " +
    "electronically, and that an electronic signature has the same legal " +
    "effect as a handwritten one. This Agreement may be signed in " +
    "counterparts, which together form one agreement. Each signer will " +
    "receive access to the completed, signed copy for their records.",
};

const ATTORNEY_REVIEW_NOTE: ContractSection = {
  key: "attorney_review_note",
  title: "Important Note — Attorney Review",
  body:
    "This document was generated from a standard Redmont Strategies Group " +
    "template. It is offered as a practical, plain-English starting point " +
    "— not as legal advice, and RSG is not a law firm. Every business " +
    "situation is different, and {{client_business}} is encouraged to have " +
    "this Agreement reviewed by its own attorney before signing. RSG will " +
    "consider reasonable revision requests in good faith.",
};

// ---------------------------------------------------------------------------
// Shared acknowledgments
// ---------------------------------------------------------------------------

const ACK_AUTHORIZED: ContractAcknowledgment = {
  key: "authorized_signer",
  label: "I am authorized to sign this Agreement on behalf of {{client_business}}.",
};

const ACK_SCOPE_PAYMENT: ContractAcknowledgment = {
  key: "reviewed_scope_payment",
  label:
    "I have reviewed the scope of services and the payment schedule described in this Agreement.",
};

const ACK_READ: ContractAcknowledgment = {
  key: "read_and_understood",
  label:
    "I have read and understood this Agreement, including the note encouraging independent attorney review.",
};

const ACK_ESIGN: ContractAcknowledgment = {
  key: "esign_consent",
  label:
    "I agree that my electronic signature is legally binding, the same as a handwritten signature.",
};

const STANDARD_ACKS: ContractAcknowledgment[] = [
  ACK_AUTHORIZED,
  ACK_SCOPE_PAYMENT,
  ACK_READ,
  ACK_ESIGN,
];

const NON_COMMERCIAL_ACKS: ContractAcknowledgment[] = [
  ACK_AUTHORIZED,
  ACK_READ,
  ACK_ESIGN,
];

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const CONTRACT_TEMPLATES: Record<ContractKind, ContractTemplate> = {
  msa: {
    kind: "msa",
    label: CONTRACT_KIND_LABELS.msa,
    sections: [
      parties("msa"),
      {
        key: "engagement_structure",
        title: "How This Agreement Works",
        body:
          "This Master Service Agreement sets the general terms for all " +
          "work RSG performs for {{client_business}}. The specific " +
          "services, deliverables, timelines, and pricing for each " +
          "engagement are described in one or more Statements of Work or " +
          "approved proposals issued under this Agreement. If a Statement " +
          "of Work conflicts with this Agreement, the Statement of Work " +
          "controls for that project only.\n\nThe initial engagement " +
          "contemplated under this Agreement is summarized as:\n\n" +
          "{{scope_summary}}",
      },
      TERM,
      PAYMENT,
      CONFIDENTIALITY,
      INTELLECTUAL_PROPERTY,
      WARRANTIES,
      TERMINATION,
      GOVERNING_LAW,
      ELECTRONIC_SIGNATURE,
      ATTORNEY_REVIEW_NOTE,
    ],
    acknowledgments: STANDARD_ACKS,
  },

  project: {
    kind: "project",
    label: CONTRACT_KIND_LABELS.project,
    sections: [
      parties("project"),
      {
        key: "scope_of_services",
        title: "Scope of Services",
        body:
          "RSG will design, build, and deliver the following for " +
          "{{client_business}}:\n\n{{scope_summary}}\n\nAnything not " +
          "described above or in the referenced proposal is outside the " +
          "scope of this Agreement. Work outside the scope requires a " +
          "written change order signed by both Parties before it begins, " +
          "so there are never surprise costs.",
      },
      {
        key: "client_responsibilities",
        title: "Client Responsibilities",
        body:
          "To keep the project on schedule, the Client agrees to provide " +
          "timely feedback and approvals, supply requested content, " +
          "credentials, and access, and make a decision-maker reasonably " +
          "available. Delays in these items may reasonably shift delivery " +
          "dates by the length of the delay.",
      },
      TERM,
      PAYMENT,
      CONFIDENTIALITY,
      INTELLECTUAL_PROPERTY,
      WARRANTIES,
      TERMINATION,
      GOVERNING_LAW,
      ELECTRONIC_SIGNATURE,
      ATTORNEY_REVIEW_NOTE,
    ],
    acknowledgments: STANDARD_ACKS,
  },

  sow: {
    kind: "sow",
    label: CONTRACT_KIND_LABELS.sow,
    sections: [
      parties("sow"),
      {
        key: "relationship_to_msa",
        title: "Relationship to the Master Service Agreement",
        body:
          "This Statement of Work is issued under, and governed by, the " +
          "Master Service Agreement between the Parties. The Master " +
          "Service Agreement's terms — including confidentiality, " +
          "intellectual property, warranties, and limitations of liability " +
          "— apply to this Statement of Work. If the two documents " +
          "conflict, this Statement of Work controls for this project only.",
      },
      {
        key: "scope_and_deliverables",
        title: "Scope and Deliverables",
        body:
          "RSG will deliver the following for {{client_business}}:\n\n" +
          "{{scope_summary}}\n\nAnything not described above is outside " +
          "the scope of this Statement of Work and requires a written " +
          "change order signed by both Parties.",
      },
      {
        key: "schedule",
        title: "Schedule",
        body:
          "Work under this Statement of Work begins on {{effective_date}} " +
          "and is planned to run for {{term_length}}. Dates depend on " +
          "timely Client feedback, content, and access; delays in those " +
          "items may reasonably shift the schedule.",
      },
      PAYMENT,
      GOVERNING_LAW,
      ELECTRONIC_SIGNATURE,
      ATTORNEY_REVIEW_NOTE,
    ],
    acknowledgments: STANDARD_ACKS,
  },

  maintenance: {
    kind: "maintenance",
    label: CONTRACT_KIND_LABELS.maintenance,
    sections: [
      parties("maintenance"),
      {
        key: "maintenance_services",
        title: "Maintenance Services",
        body:
          "RSG will provide ongoing maintenance and support for the " +
          "systems described below:\n\n{{scope_summary}}\n\nMaintenance " +
          "includes monitoring, routine updates, fixes for defects in work " +
          "RSG delivered, and reasonable support requests submitted " +
          "through the client portal. It does not include new feature " +
          "development, redesigns, or third-party outages beyond RSG's " +
          "control — those are quoted separately through a change order or " +
          "new Statement of Work.",
      },
      {
        key: "term",
        title: "Term and Renewal",
        body:
          "This Agreement takes effect on {{effective_date}} and continues " +
          "for {{term_length}}. It then renews automatically for " +
          "successive periods of the same length unless either Party gives " +
          "written notice at least fourteen (14) days before the renewal " +
          "date.",
      },
      {
        key: "payment_terms",
        title: "Payment Terms",
        body:
          "The maintenance fee is {{total_investment}}, billed as follows:" +
          "\n\n{{payment_schedule}}\n\nAll amounts are in U.S. dollars. If " +
          "a payment is more than fifteen (15) days past due, RSG may " +
          "pause maintenance services until the account is brought " +
          "current. Fee changes take effect only at renewal and only with " +
          "at least thirty (30) days' written notice.",
      },
      CONFIDENTIALITY,
      INTELLECTUAL_PROPERTY,
      WARRANTIES,
      TERMINATION,
      GOVERNING_LAW,
      ELECTRONIC_SIGNATURE,
      ATTORNEY_REVIEW_NOTE,
    ],
    acknowledgments: STANDARD_ACKS,
  },

  subscription: {
    kind: "subscription",
    label: CONTRACT_KIND_LABELS.subscription,
    sections: [
      parties("subscription"),
      {
        key: "subscription_services",
        title: "Subscription Services",
        body:
          "RSG will provide {{client_business}} with the ongoing services " +
          "described below on a subscription basis:\n\n{{scope_summary}}" +
          "\n\nThe subscription covers the services listed above at the " +
          "usage levels described. Requests beyond those levels are quoted " +
          "separately before any additional charge applies.",
      },
      {
        key: "term",
        title: "Term and Renewal",
        body:
          "The subscription begins on {{effective_date}} with an initial " +
          "term of {{term_length}}, and renews automatically for " +
          "successive periods of the same length unless either Party gives " +
          "written notice at least fourteen (14) days before the renewal " +
          "date. If the Client cancels, service continues through the end " +
          "of the period already paid for.",
      },
      {
        key: "payment_terms",
        title: "Payment Terms",
        body:
          "The subscription fee is {{total_investment}}, billed as " +
          "follows:\n\n{{payment_schedule}}\n\nAll amounts are in U.S. " +
          "dollars. If a payment fails or becomes more than fifteen (15) " +
          "days past due, RSG may suspend the subscription services until " +
          "the account is brought current. Fee changes take effect only at " +
          "renewal and only with at least thirty (30) days' written notice.",
      },
      CONFIDENTIALITY,
      INTELLECTUAL_PROPERTY,
      WARRANTIES,
      TERMINATION,
      GOVERNING_LAW,
      ELECTRONIC_SIGNATURE,
      ATTORNEY_REVIEW_NOTE,
    ],
    acknowledgments: STANDARD_ACKS,
  },

  nda: {
    kind: "nda",
    label: CONTRACT_KIND_LABELS.nda,
    sections: [
      parties("nda"),
      {
        key: "purpose",
        title: "Purpose",
        body:
          "The Parties are exchanging information so they can evaluate " +
          "and carry out a business relationship, summarized as:\n\n" +
          "{{scope_summary}}\n\nThis Agreement protects what each Party " +
          "shares during that process. It works in both directions: it " +
          "protects information shared by {{client_business}} and " +
          "information shared by RSG equally.",
      },
      {
        key: "confidential_information",
        title: "What Counts as Confidential",
        body:
          "Confidential information means non-public information one " +
          "Party shares with the other — in any form — including business " +
          "plans, financials, customer and supplier lists, pricing, " +
          "processes, systems, data, and technical details. It does not " +
          "include information that is already public through no fault of " +
          "the receiving Party, was already known to the receiving Party, " +
          "was received lawfully from someone else without restriction, or " +
          "was developed independently.",
      },
      {
        key: "obligations",
        title: "Obligations",
        body:
          "Each Party agrees to use the other's confidential information " +
          "only for the purpose above, protect it with at least the same " +
          "care it uses for its own confidential information (and never " +
          "less than reasonable care), and share it only with people who " +
          "need it for the purpose and are bound by comparable " +
          "confidentiality obligations. If disclosure is required by law, " +
          "the receiving Party will give prompt notice where legally " +
          "permitted so the disclosing Party can seek protection.",
      },
      {
        key: "term",
        title: "Term",
        body:
          "This Agreement takes effect on {{effective_date}} and the " +
          "confidentiality obligations continue for {{term_length}} from " +
          "the date of each disclosure, even if the Parties stop working " +
          "together.",
      },
      {
        key: "return_of_information",
        title: "Return or Destruction",
        body:
          "On written request, each Party will promptly return or destroy " +
          "the other's confidential information and confirm it has done " +
          "so, except for copies retained automatically in routine backups " +
          "or as required by law — which remain protected under this " +
          "Agreement.",
      },
      {
        key: "no_further_obligation",
        title: "No License, No Obligation to Proceed",
        body:
          "Sharing information under this Agreement does not transfer " +
          "ownership or grant any license beyond the purpose above, and " +
          "does not obligate either Party to enter any further agreement.",
      },
      GOVERNING_LAW,
      ELECTRONIC_SIGNATURE,
      ATTORNEY_REVIEW_NOTE,
    ],
    acknowledgments: NON_COMMERCIAL_ACKS,
  },

  dpa: {
    kind: "dpa",
    label: CONTRACT_KIND_LABELS.dpa,
    sections: [
      parties("dpa"),
      {
        key: "roles_and_scope",
        title: "Roles and Scope of Processing",
        body:
          "In providing services to {{client_business}}, RSG may handle " +
          "personal data belonging to the Client's customers, staff, or " +
          "contacts. For that data, the Client decides why and how it is " +
          "used (the controller role) and RSG handles it only on the " +
          "Client's behalf (the processor role). The processing covered by " +
          "these terms relates to:\n\n{{scope_summary}}",
      },
      {
        key: "processing_instructions",
        title: "Processing Instructions",
        body:
          "RSG will process the Client's personal data only as needed to " +
          "deliver the contracted services and only on the Client's " +
          "documented instructions, unless the law requires otherwise. RSG " +
          "will not sell the Client's personal data or use it for its own " +
          "marketing. Everyone at RSG with access to the data is bound by " +
          "confidentiality obligations.",
      },
      {
        key: "security_measures",
        title: "Security",
        body:
          "RSG maintains technical and organizational safeguards " +
          "appropriate to the data it handles, including access controls, " +
          "encryption in transit, least-privilege credentials, and private " +
          "storage with signed, expiring access links. Payment card data " +
          "is never stored on RSG systems; card payments are handled by " +
          "the payment processor.",
      },
      {
        key: "subprocessors",
        title: "Subprocessors",
        body:
          "RSG uses vetted service providers (such as hosting, database, " +
          "email, and payment infrastructure) to deliver its services. RSG " +
          "remains responsible for those providers' handling of the " +
          "Client's data, will keep a current list available on request, " +
          "and will give the Client notice of material changes to it.",
      },
      {
        key: "incident_notification",
        title: "Incident Notification",
        body:
          "If RSG becomes aware of a breach of security affecting the " +
          "Client's personal data, RSG will notify the Client without " +
          "undue delay, share what it knows about the nature and scope of " +
          "the incident, and cooperate with the Client's reasonable " +
          "response and notification obligations.",
      },
      {
        key: "term_and_deletion",
        title: "Term, Return, and Deletion",
        body:
          "These terms take effect on {{effective_date}} and apply for " +
          "{{term_length}}, and in any case for as long as RSG processes " +
          "personal data for the Client under the underlying services " +
          "agreement. When the services end, RSG will return or delete the " +
          "Client's personal data at the Client's choice, except for " +
          "copies retained in routine backups or as required by law — " +
          "which remain protected until deleted.",
      },
      {
        key: "assistance",
        title: "Assistance With Requests",
        body:
          "RSG will reasonably assist the Client in responding to " +
          "individuals exercising their privacy rights (such as access or " +
          "deletion requests) and in meeting the Client's own compliance " +
          "obligations, to the extent the requests relate to data RSG " +
          "processes for the Client.",
      },
      GOVERNING_LAW,
      ELECTRONIC_SIGNATURE,
      ATTORNEY_REVIEW_NOTE,
    ],
    acknowledgments: NON_COMMERCIAL_ACKS,
  },

  change_order: {
    kind: "change_order",
    label: CONTRACT_KIND_LABELS.change_order,
    sections: [
      parties("change_order"),
      {
        key: "reference_to_agreement",
        title: "Reference to the Existing Agreement",
        body:
          "This Change Order modifies the existing agreement between RSG " +
          "and {{client_business}} covering the current engagement. Except " +
          "as expressly changed below, all terms of that agreement — " +
          "including confidentiality, intellectual property, warranties, " +
          "limitations of liability, and governing law — remain in full " +
          "effect.",
      },
      {
        key: "description_of_change",
        title: "Description of the Change",
        body:
          "The Parties agree to the following change in scope:\n\n" +
          "{{scope_summary}}",
      },
      {
        key: "investment_adjustment",
        title: "Investment Adjustment",
        body:
          "The investment adjustment for this change is " +
          "{{total_investment}}, with {{deposit}} due on signing. Any " +
          "remaining balance follows this schedule:\n\n" +
          "{{payment_schedule}}\n\nAll amounts are in U.S. dollars and are " +
          "in addition to amounts already owed under the existing " +
          "agreement.",
      },
      {
        key: "schedule_impact",
        title: "Schedule Impact",
        body:
          "This change takes effect on {{effective_date}} and adjusts the " +
          "project schedule by {{term_length}}. Updated milestone dates " +
          "will be reflected on the project roadmap in the client portal.",
      },
      GOVERNING_LAW,
      ELECTRONIC_SIGNATURE,
      ATTORNEY_REVIEW_NOTE,
    ],
    acknowledgments: STANDARD_ACKS,
  },
};

// ---------------------------------------------------------------------------
// Placeholder substitution
// ---------------------------------------------------------------------------

function fillPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) && vars[key] !== ""
      ? vars[key]
      : match,
  );
}

/**
 * Returns the template sections for a contract kind with all known
 * placeholders replaced from `vars`. Unknown or empty placeholders are left
 * intact so drafts make missing values obvious before sending.
 */
export function fillContractSections(
  kind: ContractKind,
  vars: Record<string, string>,
): ContractSection[] {
  return CONTRACT_TEMPLATES[kind].sections.map((section) => ({
    key: section.key,
    title: fillPlaceholders(section.title, vars),
    body: fillPlaceholders(section.body, vars),
  }));
}
