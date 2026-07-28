/**
 * Marketing copy for the RSG Secure Systems Standard (the /security page and
 * the homepage security section). All language is careful: RSG is "informed by"
 * NIST and OWASP guidance — never certified, audited, or compliant with any
 * framework unless independently verified. No fabricated statistics or badges.
 */

import type { LucideIcon } from "lucide-react";
import {
  KeyRound,
  Database,
  Server,
  DatabaseBackup,
  ScrollText,
  Bot,
  Boxes,
  Siren,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";

/** The 12-item control grid used on the homepage security section. */
export const HOMEPAGE_CONTROL_GRID: string[] = [
  "Multifactor authentication",
  "Role-based permissions",
  "Encrypted data transfer",
  "Secure credential storage",
  "Automated backups",
  "Audit logs",
  "Human AI approval",
  "Environment separation",
  "Data-retention controls",
  "Incident-response planning",
  "Vendor documentation",
  "Prompt-injection testing",
];

export type SecurityPillar = {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  intro: string;
  controls: string[];
  /** A plain-language note that translates the controls into business terms. */
  note?: string;
};

/** The pillars of the Secure Systems Standard, in page order. */
export const SECURITY_PILLARS: SecurityPillar[] = [
  {
    id: "identity",
    icon: KeyRound,
    eyebrow: "Identity & access",
    title: "The right people, the right access — and nothing more",
    intro:
      "Employees, administrators, customers, contractors, and vendors should only reach the information and functions their role requires. Access is designed before the system is built, not bolted on afterward.",
    controls: [
      "Multifactor authentication",
      "Secure account creation and login",
      "Role-based access permissions",
      "Least-privilege access",
      "Session management",
      "Account recovery controls",
      "Administrative access restrictions",
      "Optional single sign-on for eligible projects",
    ],
    note: "Permissions are enforced on the server and, for databases, at the data layer — hiding a button is never treated as the control.",
  },
  {
    id: "data",
    icon: Database,
    eyebrow: "Data protection",
    title: "Sensitive data is protected and never over-collected",
    intro:
      "RSG protects data in transit and, where the selected infrastructure supports it, at rest — and avoids collecting or keeping information a system does not actually need.",
    controls: [
      "Encryption in transit",
      "Encryption at rest when supported by the infrastructure",
      "Secure database access",
      "Sensitive-field protection",
      "Data-retention controls",
      "Data-deletion workflows",
      "Export and portability controls",
      "Restricted access to confidential information",
      "Prevention of unnecessary data collection",
    ],
    note: "Less data retained means less to lose. Retention rules are documented, not assumed.",
  },
  {
    id: "secrets",
    icon: KeyRound,
    eyebrow: "Secrets management",
    title: "Credentials stay out of the browser and out of source control",
    intro:
      "API keys and credentials belong in managed secret storage — never in frontend code, never committed to the repository, and never shared across environments.",
    controls: [
      "No exposed API keys in frontend code",
      "No credentials committed to source control",
      "Environment-variable management",
      "Managed secret storage where available",
      "Restricted production credentials",
      "Credential rotation procedures",
      "Separate credentials for development, staging, and production",
      "Immediate invalidation of compromised credentials",
    ],
  },
  {
    id: "environments",
    icon: Server,
    eyebrow: "Infrastructure & environments",
    title: "Development, staging, and production stay separate",
    intro:
      "Where appropriate, work happens in separate environments. Development data should not automatically contain real customer information, and production must not rely on test credentials, placeholder integrations, mock authentication, or developer bypasses.",
    controls: [
      "Separate development, staging, and production environments",
      "Real customer data kept out of development by default",
      "No test credentials or mock authentication in production",
      "Production debugging disabled",
      "Demo systems isolated from production data",
      "Secure deployment process",
    ],
  },
  {
    id: "backups",
    icon: DatabaseBackup,
    eyebrow: "Backups & recovery",
    title: "Recovery is planned, documented, and tested",
    intro:
      "It is not enough to say backups exist. RSG documents what is backed up, how often, how long it is retained, and how a restoration would actually be performed.",
    controls: [
      "Automated database backups",
      "Configurable backup frequency",
      "Retention schedules",
      "Restoration procedures",
      "Recovery testing",
      "File and document backup considerations",
      "Business-continuity planning",
      "Defined recovery expectations when in scope",
    ],
  },
  {
    id: "logging",
    icon: ScrollText,
    eyebrow: "Logging & accountability",
    title: "A clear record of who did what, when, and to which record",
    intro:
      "Important administrative, customer-data, and AI actions are logged so a business can understand what happened and who authorized it — without ever writing passwords, keys, or full payment details into the logs.",
    controls: [
      "Activity logs",
      "Administrative audit logs",
      "Authentication events",
      "Permission changes",
      "Record creation, modification, and deletion events",
      "AI-generated action records",
      "Integration-failure records",
      "Exportable logs when appropriate",
    ],
  },
  {
    id: "responsible-ai",
    icon: Bot,
    eyebrow: "Responsible AI controls",
    title: "AI should not have unlimited authority",
    intro:
      "For systems that generate content, make recommendations, access business data, or communicate with customers, RSG can require a human to approve high-risk actions before anything happens — and keeps untrusted input separate from instructions.",
    controls: [
      "Human approval for high-risk actions",
      "Permission-aware document access",
      "Restricted tool access",
      "Approved data-source boundaries",
      "Prompt-injection and disclosure testing",
      "Output validation and structured outputs",
      "Rate limits and action limits",
      "Escalation to a human",
      "Audit trails for AI actions",
      "Emergency disable controls",
    ],
    note: "High-risk actions — sending contracts, issuing refunds, changing pricing, deleting records, sharing confidential documents — do not execute automatically without deliberate authorization.",
  },
  {
    id: "vendors",
    icon: Boxes,
    eyebrow: "Vendor management",
    title: "Know where your data goes",
    intro:
      "RSG documents the third-party platforms involved in each system — hosting, databases, email, SMS, payments, analytics, AI models, storage, and authentication — what they are used for, and what categories of information they may process.",
    controls: [
      "Vendor name and service",
      "Business purpose and data handled",
      "Hosting region when known",
      "Security documentation and agreement status",
      "Subprocessors",
      "Access level",
      "Renewal and review dates",
      "Replacement or removal procedure",
    ],
    note: "RSG does not automatically claim that any vendor is approved for a regulated industry.",
  },
  {
    id: "incident-response",
    icon: Siren,
    eyebrow: "Incident response",
    title: "A plan for when something goes wrong",
    intro:
      "Every qualified project includes an incident-response procedure sized to its risk — how an incident is detected, who is responsible, how access is contained, how credentials are rotated, how systems are isolated, how services are restored, and how affected clients are notified.",
    controls: [
      "Detection and ownership",
      "Access containment",
      "Credential rotation",
      "System isolation",
      "Log preservation",
      "Service restoration",
      "Client notification",
      "Documented lessons and corrective actions",
    ],
  },
  {
    id: "testing",
    icon: FlaskConical,
    eyebrow: "Testing & maintenance",
    title: "Security is verified, then maintained",
    intro:
      "AI-enabled projects are tested against an internal checklist — prompt injection, sensitive-information disclosure, permission bypass, data leakage, excessive agency, and more — with results, severity, evidence, and retest status recorded.",
    controls: [
      "Prompt-injection and indirect-injection testing",
      "Sensitive-information disclosure testing",
      "Permission-bypass and unauthorized-retrieval testing",
      "Data-leakage testing between customers",
      "Excessive-agency and unsafe-tool-call testing",
      "Abuse and rate-limit testing",
      "Backup restoration testing",
      "Periodic security review",
    ],
  },
];

/** The NIST-style AI risk process, translated to plain business language. */
export type FrameworkStage = {
  name: string;
  summary: string;
  items: string[];
};

export const FRAMEWORK_STAGES: FrameworkStage[] = [
  {
    name: "Govern",
    summary: "Decide who owns the AI, what it may do, and how much risk is acceptable.",
    items: [
      "Ownership and responsibilities",
      "Acceptable use and risk tolerance",
      "Approval requirements",
      "Documentation standards",
      "Vendor oversight",
      "Incident escalation",
    ],
  },
  {
    name: "Map",
    summary: "Understand the intended use, who it affects, and what could go wrong.",
    items: [
      "Intended use and users",
      "Data sources and dependencies",
      "Affected people and business consequences",
      "Potential misuse",
      "Regulatory considerations",
      "Actions the AI can perform",
    ],
  },
  {
    name: "Measure",
    summary: "Evaluate how well it works and how it fails.",
    items: [
      "Accuracy and reliability",
      "Security and privacy",
      "Prompt-injection resistance",
      "Data-leakage risk",
      "Failure behavior",
      "Human-approval effectiveness and logging completeness",
    ],
  },
  {
    name: "Manage",
    summary: "Put controls in place and keep them current.",
    items: [
      "Risk controls and restricted permissions",
      "Human review and monitoring",
      "Incident procedures and remediation",
      "Model or vendor changes",
      "Feature shutdown procedures",
      "Periodic reassessment",
    ],
  },
];

/** OWASP-informed generative-AI risks, in business language. */
export const OWASP_AI_RISKS: { risk: string; how: string }[] = [
  { risk: "Prompt injection", how: "Untrusted input is kept separate from instructions and tested against injection." },
  { risk: "Sensitive-information disclosure", how: "The assistant is scoped so it cannot reveal data beyond a user's permissions." },
  { risk: "Improper output handling", how: "AI output is treated as untrusted — escaped when displayed, validated before any action." },
  { risk: "Excessive agency", how: "Tool access is restricted and high-risk actions require human approval." },
  { risk: "Insecure integrations", how: "Third-party connections are documented, scoped, and reviewed." },
  { risk: "Unauthorized access", how: "Authorization is enforced server-side and, for databases, at the data layer." },
  { risk: "Unsafe dependency or vendor usage", how: "Vendors and dependencies are documented and reviewed." },
  { risk: "Unbounded resource consumption", how: "Rate limits and action limits contain cost and abuse." },
];

/** Careful compliance-posture statements (no unverified claims). */
export const COMPLIANCE_STATEMENTS: string[] = [
  "Built using principles informed by NIST and OWASP guidance.",
  "Security controls are selected based on project requirements.",
  "Designed around secure development and responsible-AI practices.",
  "Compliance-ready architecture may be available when specifically scoped.",
  "Final compliance obligations depend on the client, industry, vendors, configuration, and legal requirements.",
];

export const SECURITY_FAQS: { q: string; a: string }[] = [
  {
    q: "Is RSG certified or compliant with SOC 2, HIPAA, or other frameworks?",
    a: "No. RSG builds using principles informed by NIST and OWASP guidance, but it does not represent itself as certified, audited, or compliant with any framework unless that status has been independently verified for a specific engagement. Compliance-ready architecture can be scoped when a project requires it, and final compliance obligations depend on the client, industry, vendors, configuration, and legal requirements.",
  },
  {
    q: "Does every system get every control?",
    a: "No. Security controls are selected based on the project. A marketing website needs secure forms, spam protection, admin authentication, backups, and secure deployment. A CRM adds role-based permissions, audit logs, retention rules, and recovery procedures. An AI operations system adds tool restrictions, human approval, prompt-injection testing, and complete AI action logging.",
  },
  {
    q: "How does RSG keep AI from doing something it shouldn't?",
    a: "High-risk AI actions — sending contracts, issuing refunds, changing pricing, deleting records, sharing confidential documents, making financial commitments — do not execute automatically. They enter an approval queue where a human can approve, reject, edit, or escalate before anything happens, and every AI action can be logged.",
  },
  {
    q: "What happens to my data, and where does it go?",
    a: "RSG documents the third-party platforms involved in your system, what each is used for, and what categories of information it may process. Data is protected in transit and, where the infrastructure supports it, at rest. RSG also avoids collecting or retaining information a system does not actually need.",
  },
  {
    q: "Are backups real, or just a checkbox?",
    a: "RSG documents what is backed up, how often, how long it is retained, and how a restoration would be performed — and restoration is tested rather than assumed. Backup status shown in the admin console reflects real infrastructure or is clearly marked when it cannot be verified from the console.",
  },
  {
    q: "What if there's a security incident?",
    a: "Every qualified project includes an incident-response procedure sized to its risk: how an incident is detected, who is responsible, how access is contained, how credentials are rotated, how systems are isolated, how logs are preserved, how services are restored, and how affected clients are notified — with lessons and corrective actions documented.",
  },
];

export const STANDARD_ICON = ShieldCheck;
