/**
 * Per-project security control sets for the "Security Included" sections on
 * service and industry pages. The controls shown change with the kind of
 * system, as the RSG Secure Systems Standard prescribes.
 */

export type SecurityVariant =
  | "website"
  | "crm"
  | "ai_ops"
  | "operations"
  | "consulting"
  | "private_ai";

export type SecurityVariantDef = {
  eyebrow: string;
  title: string;
  intro: string;
  controls: string[];
};

export const SECURITY_VARIANTS: Record<SecurityVariant, SecurityVariantDef> = {
  website: {
    eyebrow: "Security included",
    title: "Secure from the first deploy",
    intro:
      "Even a marketing website handles real inquiries and admin access. RSG builds the essentials in, so forms, logins, and deployments are protected from day one.",
    controls: [
      "Secure forms with validation",
      "Spam and abuse protection",
      "Admin authentication",
      "Automated backups",
      "Secure deployment process",
      "Analytics consent controls",
    ],
  },
  crm: {
    eyebrow: "Security included",
    title: "Built to hold customer data responsibly",
    intro:
      "A CRM concentrates your most sensitive relationships and pipeline. RSG builds it with controlled access, accountability, and recovery from the start.",
    controls: [
      "Role-based permissions",
      "Audit logs",
      "Data exports and portability",
      "Retention rules",
      "Encrypted connections",
      "Backup and recovery procedures",
    ],
  },
  ai_ops: {
    eyebrow: "Security included",
    title: "AI that operates within guardrails",
    intro:
      "When AI touches business data or takes actions, control matters more than novelty. RSG scopes what it can reach and requires a human for high-risk actions.",
    controls: [
      "Tool restrictions",
      "Human approval for high-risk actions",
      "Prompt-injection testing",
      "Data-access boundaries",
      "Output validation",
      "Complete AI action logging",
    ],
  },
  operations: {
    eyebrow: "Security included",
    title: "An operating system built for accountability",
    intro:
      "A business operating system connects leads, scheduling, follow-up, and reporting. RSG designs access, approvals, and recovery so the whole system is trustworthy.",
    controls: [
      "Granular role-based access",
      "Detailed audit logs",
      "Human approval for high-risk automations",
      "Automated backups and recovery",
      "Environment separation",
      "Incident-response planning",
    ],
  },
  consulting: {
    eyebrow: "Security included",
    title: "Security is part of every build",
    intro:
      "Whatever RSG builds for you, it is designed with controlled access, secure credentials, backups, audit trails, and documented recovery — not added after the fact.",
    controls: [
      "Multifactor authentication",
      "Role-based permissions",
      "Encrypted data transfer",
      "Secure credential storage",
      "Automated backups",
      "Audit logs",
    ],
  },
  private_ai: {
    eyebrow: "Security included",
    title: "Confidentiality-focused by design",
    intro:
      "Private AI is built around how information is stored, retrieved, logged, accessed, and deleted — with deployment options that keep sensitive data under your control.",
    controls: [
      "Local or private-cloud deployment options",
      "Permission-based knowledge access",
      "Human approval workflows",
      "Audit logs for AI actions",
      "Custom retention settings",
      "Emergency shutdown controls",
    ],
  },
};

/** Choose a sensible variant for a local/industry page from its slug. */
export function variantForSlug(slug: string): SecurityVariant {
  if (slug.includes("crm") || slug.includes("pipeline")) return "crm";
  if (slug.includes("privateai")) return "private_ai";
  if (slug.includes("aiautomation") || slug.includes("aistrategy")) return "ai_ops";
  if (slug.includes("webdevelopment") || slug.includes("digitalinfrastructure"))
    return "website";
  if (slug.includes("operations")) return "operations";
  // Industry solution pages and general consulting pages.
  return "consulting";
}
