import type {
  DesignerConfig,
  DeploymentModelId,
  SimulatedArchitecture,
  SystemTypeId,
} from "./types";

const DEPLOYMENT_NAMES: Record<DeploymentModelId, { name: string; summary: string }> = {
  fully_local: {
    name: "Fully Local AI",
    summary:
      "The AI model, company data, databases, and supporting services run on hardware controlled by your organization.",
  },
  on_premise: {
    name: "On-Premise AI",
    summary:
      "Installed within your office, facility, warehouse, practice, or other physical location on your local network.",
  },
  private_cloud: {
    name: "Private Cloud AI",
    summary:
      "Runs inside a dedicated private cloud environment you control or that is provisioned specifically for your organization.",
  },
  hybrid: {
    name: "Hybrid AI",
    summary:
      "Sensitive data and core processing stay local while approved cloud services handle specific, non-sensitive tasks.",
  },
  secure_managed: {
    name: "Secure Managed AI",
    summary:
      "RSG manages infrastructure, monitoring, maintenance, backups, updates, permissions, and support in an isolated environment.",
  },
};

const SYSTEM_LABELS: Record<SystemTypeId, string> = {
  internal_assistant: "Internal AI assistant",
  customer_service: "Customer service AI",
  phone_assistant: "AI phone assistant",
  document_processing: "Document processing",
  operations_automation: "Operations automation",
  reporting: "Reporting assistant",
  custom_agent: "Custom AI agent",
};

const SYSTEM_COMPONENTS: Record<SystemTypeId, string[]> = {
  internal_assistant: [
    "Permission-aware retrieval layer",
    "Internal knowledge index",
    "Role-scoped response policy",
    "Employee chat interface",
  ],
  customer_service: [
    "Approved knowledge base",
    "Channel adapters (web, SMS, email)",
    "Confidence-based escalation",
    "Support dashboard handoff",
  ],
  phone_assistant: [
    "Voice intake and routing",
    "Appointment scheduling tools",
    "CRM write-back with validation",
    "Consent and recording controls",
  ],
  document_processing: [
    "Document intake pipeline",
    "Classification and extraction models",
    "Validation rules",
    "Routing and archive hooks",
  ],
  operations_automation: [
    "Workflow orchestration",
    "Scheduling and task tools",
    "Exception queues",
    "Operations dashboard",
  ],
  reporting: [
    "Approved metrics warehouse connection",
    "Narrative summary engine",
    "Scheduled report jobs",
    "Natural-language query interface",
  ],
  custom_agent: [
    "Multi-step agent planner",
    "Tool connectors",
    "Approval gate service",
    "Action audit trail",
  ],
};

const SYSTEM_WORKFLOWS: Record<SystemTypeId, string[]> = {
  internal_assistant: [
    "Employee asks a policy or process question",
    "System retrieves only authorized sources",
    "Answer is generated with citations where available",
    "Low-confidence or restricted topics escalate to a human",
  ],
  customer_service: [
    "Customer reaches an approved channel",
    "Identity and permission checks run",
    "Assistant responds from approved knowledge",
    "Sensitive or uncertain cases route to staff",
  ],
  phone_assistant: [
    "Call is answered with configured greeting",
    "Intent is classified and information collected",
    "Appointment or CRM record is created when rules allow",
    "Complex or emergency calls escalate immediately",
  ],
  document_processing: [
    "Document arrives via email, upload, or integration",
    "System classifies and extracts structured fields",
    "Validation flags exceptions for review",
    "Clean records route to the destination system",
  ],
  operations_automation: [
    "Trigger arrives from schedule, form, or system event",
    "Agent assembles context from approved sources",
    "Recommended actions are prepared",
    "High-impact steps wait for human approval",
  ],
  reporting: [
    "Manager asks a question or a scheduled report runs",
    "System queries approved datasets only",
    "Narrative summary and charts are produced",
    "Unusual signals are highlighted for review",
  ],
  custom_agent: [
    "Business event starts the agent",
    "Agent completes permitted intermediate steps",
    "Approval gate pauses high-impact actions",
    "Final state is logged and stakeholders notified",
  ],
};

export function buildSimulatedArchitecture(
  config: DesignerConfig
): SimulatedArchitecture {
  const deployment =
    DEPLOYMENT_NAMES[config.deployment] ?? DEPLOYMENT_NAMES.private_cloud;
  const systemLabel = SYSTEM_LABELS[config.systemType] ?? "Custom AI system";

  const security = [
    ...config.privacyControls,
    "Environment separation",
    "Encrypted transport for connected services",
  ];

  return {
    recommendedDeployment: `${deployment.name} — ${deployment.summary}`,
    coreComponents: [
      `${systemLabel} application layer`,
      ...SYSTEM_COMPONENTS[config.systemType],
      `${config.businessType} workflow adapters`,
    ],
    integrations: config.dataSources.length
      ? config.dataSources
      : ["Approved internal systems (to be confirmed in discovery)"],
    securityControls: Array.from(new Set(security)),
    exampleRoles: [
      "Executive sponsor",
      "System administrator",
      "Department manager",
      "Frontline employee",
      "Auditor / reviewer",
    ],
    exampleWorkflow: SYSTEM_WORKFLOWS[config.systemType],
    implementationPhases: [
      "Discovery and security scoping",
      "Prototype against one high-value workflow",
      "Integrations and permissions",
      "Pilot with a defined user group",
      "Production hardening and training",
    ],
    nextStep:
      "Book a technical consultation so RSG can validate infrastructure, data sensitivity, and the right deployment model for your business.",
    disclaimer:
      "This is an illustrative system concept based on your selections. It is not a final technical assessment, security certification, compliance determination, or binding quote.",
  };
}

export function deploymentLabel(id: DeploymentModelId): string {
  return DEPLOYMENT_NAMES[id]?.name ?? id;
}
