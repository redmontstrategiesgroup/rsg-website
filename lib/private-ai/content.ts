import type { DeploymentModelId, SystemTypeId } from "./types";

export const PRIVATE_AI_PATH = "/services/customprivateaisystems";

export const DEPLOYMENT_OPTIONS: {
  id: DeploymentModelId;
  name: string;
  summary: string;
  suitable: string[];
  privacy: string;
  ownership: string;
  internet: string;
  scalability: string;
  setup: string;
  maintenance: string;
  bestFit: string;
  pricing: string;
}[] = [
  {
    id: "fully_local",
    name: "Fully Local AI",
    summary:
      "The AI model, company data, databases, and supporting services run on hardware controlled by your organization.",
    suitable: [
      "Highly sensitive information",
      "Limited or restricted internet access",
      "Internal company operations",
      "Maximum data control requirements",
    ],
    privacy: "Highest",
    ownership: "Client-owned hardware",
    internet: "Optional / offline-capable",
    scalability: "Hardware-bound",
    setup: "Higher",
    maintenance: "Client or RSG-supported",
    bestFit: "Regulated ops, air-gapped teams, proprietary IP",
    pricing: "Based on Infrastructure and Scope",
  },
  {
    id: "on_premise",
    name: "On-Premise AI",
    summary:
      "Installed within your office, facility, warehouse, practice, or other physical location on your local network.",
    suitable: [
      "Internal document access",
      "Employee assistants",
      "Facility operations",
      "Local network integrations",
      "Controlled internal access",
    ],
    privacy: "Very high",
    ownership: "Client facility",
    internet: "Usually limited",
    scalability: "Site capacity",
    setup: "Moderate–higher",
    maintenance: "Shared",
    bestFit: "Single-site teams with internal IT access",
    pricing: "Custom Quote",
  },
  {
    id: "private_cloud",
    name: "Private Cloud AI",
    summary:
      "Runs inside a dedicated private cloud environment you control or that is provisioned specifically for your organization.",
    suitable: [
      "Remote teams",
      "Multiple locations",
      "Secure scalability",
      "Centralized administration",
      "Controlled external access",
    ],
    privacy: "High",
    ownership: "Client or dedicated tenancy",
    internet: "Required",
    scalability: "High",
    setup: "Moderate",
    maintenance: "Shared or managed",
    bestFit: "Multi-location and distributed teams",
    pricing: "Based on Infrastructure and Scope",
  },
  {
    id: "hybrid",
    name: "Hybrid AI",
    summary:
      "Sensitive data and core processing stay local while approved cloud services handle specific, non-sensitive tasks.",
    suitable: [
      "Privacy with flexibility",
      "Multi-location businesses",
      "Local and remote access needs",
      "Transitioning away from public AI tools",
    ],
    privacy: "Configurable",
    ownership: "Split local + cloud",
    internet: "Partial",
    scalability: "Flexible",
    setup: "Moderate–higher",
    maintenance: "Shared",
    bestFit: "Teams balancing control and reach",
    pricing: "Custom Quote",
  },
  {
    id: "secure_managed",
    name: "Secure Managed AI",
    summary:
      "RSG manages infrastructure, monitoring, maintenance, backups, updates, permissions, and support in an isolated environment.",
    suitable: [
      "No internal IT department",
      "Managed solution preference",
      "Ongoing optimization and support",
    ],
    privacy: "High (isolated)",
    ownership: "RSG-managed private env",
    internet: "Required",
    scalability: "High",
    setup: "Lower for the client",
    maintenance: "RSG",
    bestFit: "Operators who want outcomes without running infrastructure",
    pricing: "Based on Infrastructure and Scope",
  },
];

export const SYSTEMS_WE_BUILD: {
  id: string;
  name: string;
  summary: string;
  capabilities: string[];
  note?: string;
}[] = [
  {
    id: "assistant",
    name: "Private Company AI Assistant",
    summary:
      "An internal assistant grounded in approved company information, policies, procedures, products, and operational knowledge.",
    capabilities: [
      "Answer employee questions",
      "Search company documents",
      "Explain policies",
      "Find forms and files",
      "Guide process steps",
      "Generate internal reports",
      "Provide role-specific responses",
    ],
  },
  {
    id: "knowledge",
    name: "Private Knowledge and Document System",
    summary:
      "Secure knowledge search across internal sources with permission-aware retrieval so users only see what they are authorized to access.",
    capabilities: [
      "PDFs, Word docs, spreadsheets",
      "SOPs and training materials",
      "Manuals and contracts",
      "Internal databases and CRM records",
      "Project and product documentation",
    ],
  },
  {
    id: "operations",
    name: "Custom AI Operations Platform",
    summary:
      "A central system that assists with day-to-day operations across scheduling, quoting, communication, and workflow automation.",
    capabilities: [
      "Scheduling and dispatching",
      "Quoting and lead qualification",
      "Customer communication",
      "Task and inventory management",
      "Reporting and quality control",
      "Employee support workflows",
    ],
  },
  {
    id: "support",
    name: "Private Customer Service AI",
    summary:
      "A secure support assistant trained on your services, products, policies, and approved account knowledge—with human escalation.",
    capabilities: [
      "Website chat and client portal",
      "SMS and email channels",
      "Internal support dashboards",
      "Phone or voice handoffs",
      "Escalation on uncertainty or sensitive requests",
    ],
  },
  {
    id: "phone",
    name: "Private AI Phone System",
    summary:
      "A custom AI receptionist that answers, qualifies, schedules, routes, and creates records—with clear consent and recording controls.",
    capabilities: [
      "Answer and route calls",
      "Qualify leads and collect information",
      "Schedule appointments",
      "Answer approved questions",
      "Create CRM records and follow-ups",
      "Escalate emergencies or complex calls",
    ],
    note: "Call recording, consent, and communications requirements must be configured for applicable laws and your policies.",
  },
  {
    id: "documents",
    name: "AI Document Processing System",
    summary:
      "Extract, classify, organize, validate, and route information from operational documents without sending them to public AI platforms.",
    capabilities: [
      "Invoices, estimates, and receipts",
      "Applications and forms",
      "Contracts and service reports",
      "Inspection documents and emails",
      "Customer submissions",
    ],
  },
  {
    id: "reporting",
    name: "AI Reporting and Business Intelligence",
    summary:
      "A private analytics assistant connected to approved company data for summaries, KPI explanation, and recurring management reports.",
    capabilities: [
      "Management summaries",
      "Operational performance analysis",
      "KPI change explanations",
      "Bottleneck and anomaly signals",
      "Location or department comparisons",
      "Natural-language questions about company data",
    ],
  },
  {
    id: "agents",
    name: "Custom AI Agents",
    summary:
      "Purpose-built agents that complete multi-step processes with configurable approval gates before high-impact actions.",
    capabilities: [
      "Review leads and check availability",
      "Prepare quotes and draft follow-ups",
      "Update CRM and assign tasks",
      "Notify staff and summarize for management",
      "Approval gates for send, price, refund, and account changes",
    ],
  },
];

export const SECURITY_CAPABILITIES = [
  "Local model hosting",
  "Private cloud hosting",
  "Encryption in transit and at rest",
  "Role-based access control",
  "Multi-factor authentication",
  "Single sign-on integration",
  "User and administrator permissions",
  "Department-level access",
  "Document-level permissions",
  "Audit logs and activity history",
  "Data retention controls",
  "Backup and recovery options",
  "Isolated databases",
  "API permission restrictions",
  "Secret and credential management",
  "Network allowlists",
  "Human approval workflows",
  "AI response logging",
  "Sensitive-data redaction",
  "Configurable model access",
  "Data deletion workflows",
  "Environment separation (dev, staging, production)",
  "Controlled document ingestion",
  "Data-source restrictions",
  "Restricted external integrations",
  "Private chat or voice interfaces",
  "Emergency shutdown controls",
  "Vendor transparency",
  "No unnecessary third-party data exposure",
];

export const MODEL_OPTIONS = [
  "Open-source language models",
  "Privately hosted commercial models",
  "Small specialized local models",
  "Vision models",
  "Speech recognition and text-to-speech",
  "Document extraction and classification models",
  "Forecasting and recommendation systems",
  "Rules-based automation combined with AI",
  "Retrieval-augmented generation",
  "Fine-tuned models where appropriate",
  "Multi-model routing by cost, privacy, speed, and task complexity",
];

export const INTEGRATION_CATEGORIES = [
  "CRM platforms",
  "ERP systems",
  "Scheduling software",
  "Email",
  "Phone systems",
  "SMS providers",
  "Accounting platforms",
  "File storage",
  "Internal databases",
  "Company websites",
  "Client portals",
  "Inventory systems",
  "Help desks",
  "Custom APIs",
  "Existing internal software",
  "IoT or operational equipment where appropriate",
];

export const INDUSTRY_USE_CASES: {
  name: string;
  examples: string[];
}[] = [
  {
    name: "HVAC, Plumbing & Electrical",
    examples: [
      "Private technician knowledge assistant",
      "Service history search",
      "AI dispatch recommendations",
      "Quote preparation support",
      "Equipment manual search",
      "Call qualification and maintenance plan management",
    ],
  },
  {
    name: "Exterior Contracting & Construction",
    examples: [
      "Estimate and scope assistants",
      "Job packet and document routing",
      "Crew and schedule coordination support",
      "Change-order draft preparation",
      "Safety SOP search",
    ],
  },
  {
    name: "Property Management",
    examples: [
      "Resident inquiry triage",
      "Work-order summarization",
      "Lease and policy search",
      "Vendor coordination drafts",
      "Portfolio operations reporting",
    ],
  },
  {
    name: "Retail",
    examples: [
      "Private inventory assistant",
      "Product knowledge search",
      "Store performance reporting",
      "Employee training assistant",
      "Customer support with escalation",
      "Multi-location operations assistant",
    ],
  },
  {
    name: "Professional Services",
    examples: [
      "Matter or engagement knowledge search",
      "Proposal and SOW drafting aids",
      "Internal policy assistants",
      "Client portal Q&A with permissions",
    ],
  },
  {
    name: "Healthcare Administration & Dental",
    examples: [
      "Internal policy search",
      "Administrative workflow assistance",
      "Secure document routing",
      "Scheduling support",
      "Employee knowledge systems",
    ],
  },
  {
    name: "Legal Operations & Financial Services",
    examples: [
      "Controlled document retrieval",
      "Intake classification",
      "Internal playbook assistants",
      "Audit-ready activity logging",
    ],
  },
  {
    name: "Manufacturing, Warehousing & Transportation",
    examples: [
      "SOP and equipment assistants",
      "Shift handoff summaries",
      "Inventory and exception reporting",
      "Route and dispatch support tools",
    ],
  },
  {
    name: "Multi-location Businesses",
    examples: [
      "Central policy assistant with local overrides",
      "Cross-location KPI explanations",
      "Shared knowledge with site-level permissions",
      "Standardized customer communication drafts",
    ],
  },
];

export const PROCESS_STAGES = [
  {
    step: 1,
    title: "Business and Security Discovery",
    body: "Map goals, sensitive data, access patterns, and compliance expectations before any model is chosen.",
  },
  {
    step: 2,
    title: "Workflow and Data Mapping",
    body: "Document how work actually moves—systems, handoffs, approvals, and where automation creates leverage.",
  },
  {
    step: 3,
    title: "Infrastructure Recommendation",
    body: "Recommend local, on-premise, private cloud, hybrid, or managed deployment based on control and operations reality.",
  },
  {
    step: 4,
    title: "Prototype Development",
    body: "Build a focused prototype against real workflows so stakeholders can evaluate usefulness early.",
  },
  {
    step: 5,
    title: "Integration and Permission Setup",
    body: "Connect approved tools and enforce role, department, and document-level access from the start.",
  },
  {
    step: 6,
    title: "Security Testing",
    body: "Validate authentication, authorization, logging, redaction, and failure modes before wider access.",
  },
  {
    step: 7,
    title: "Controlled Pilot",
    body: "Roll out to a defined user group with monitoring, feedback loops, and clear escalation paths.",
  },
  {
    step: 8,
    title: "Employee Training",
    body: "Train teams on when to trust outputs, when to escalate, and how to work with approval gates.",
  },
  {
    step: 9,
    title: "Production Deployment",
    body: "Promote to production with environment separation, backups, and operational runbooks.",
  },
  {
    step: 10,
    title: "Monitoring and Continuous Improvement",
    body: "Track quality, usage, incidents, and expansion opportunities after launch.",
  },
];

export const PRIVATE_AI_FAQS: { q: string; a: string }[] = [
  {
    q: "Can the AI run without an internet connection?",
    a: "Yes, when designed as a fully local or carefully scoped on-premise system. Offline capability depends on the models, data sources, and integrations selected for your environment.",
  },
  {
    q: "Can the system run entirely inside our office?",
    a: "Yes. On-premise and fully local deployments are built for organizations that want processing and storage inside their facility or on company-owned hardware.",
  },
  {
    q: "Will our data be used to train public AI models?",
    a: "No. RSG does not use your confidential information to train unrelated customer systems or public models. Data handling is defined in the engagement and deployment design.",
  },
  {
    q: "Can different employees have different permissions?",
    a: "Yes. Systems are designed with role-based access, and can include department and document-level permissions so retrieval and actions stay within authorized scope.",
  },
  {
    q: "Can the AI connect to our current software?",
    a: "In most cases, yes—through approved APIs, connectors, or custom integrations to CRM, scheduling, email, phone, accounting, storage, and internal tools you authorize.",
  },
  {
    q: "Can we use our existing servers?",
    a: "Often. We assess capacity, reliability, networking, and security posture first. Some projects use existing hardware; others need dedicated or upgraded infrastructure.",
  },
  {
    q: "Do we need to buy specialized hardware?",
    a: "Not always. Hardware needs depend on model size, concurrency, and whether you choose local hosting. Managed and private cloud options can reduce or eliminate on-site hardware purchases.",
  },
  {
    q: "Can the system work across multiple locations?",
    a: "Yes. Private cloud and hybrid designs commonly support multi-location access with centralized administration and location-aware permissions.",
  },
  {
    q: "Can the AI access confidential documents?",
    a: "Only when you explicitly connect those sources and assign permissions. Permission-aware retrieval is designed so users receive only information they are authorized to see.",
  },
  {
    q: "How do you prevent unauthorized access?",
    a: "Through layered controls such as authentication, MFA or SSO where applicable, role-based permissions, network restrictions, audit logs, and environment separation. Exact controls depend on your deployment.",
  },
  {
    q: "Can employees review the AI’s activity?",
    a: "Yes. Activity history and response logging can be enabled so supervisors can review what was asked, retrieved, and recommended.",
  },
  {
    q: "What happens when the AI is uncertain?",
    a: "Systems can escalate to a human, ask clarifying questions, or refuse when confidence is low or a request is sensitive—based on thresholds you configure.",
  },
  {
    q: "Can the system require human approval?",
    a: "Yes. High-impact actions such as sending communications, changing prices, issuing refunds, or updating accounts can require approval gates before execution.",
  },
  {
    q: "Can RSG maintain the system after launch?",
    a: "Yes. Ongoing monitoring, updates, backups, permission changes, and optimization are available—especially with Secure Managed deployments.",
  },
  {
    q: "How long does implementation take?",
    a: "Timelines vary with scope, integrations, infrastructure, and security review. A focused prototype can move quickly; production systems with deep integrations and compliance review take longer. We estimate after discovery.",
  },
  {
    q: "Can the system be expanded later?",
    a: "Yes. Most engagements start with a high-value workflow and expand to additional assistants, agents, channels, or data sources once the foundation is stable.",
  },
  {
    q: "Can it replace our existing software?",
    a: "Usually it should not. Private AI is typically designed to operate alongside your current systems—searching, assisting, and automating—rather than forcing a rip-and-replace.",
  },
  {
    q: "Can it operate alongside our current systems?",
    a: "Yes. Integration with approved tools is a core design goal so the AI fits how your business already runs.",
  },
  {
    q: "Is private AI automatically compliant with industry regulations?",
    a: "No. Systems can be designed around applicable security and compliance requirements, but final compliance depends on your complete environment, policies, legal obligations, and implementation. Regulated data requires a dedicated security, legal, infrastructure, and compliance review.",
  },
];

export const DESIGNER_BUSINESS_TYPES = [
  "Home services",
  "Retail",
  "Healthcare administration",
  "Professional services",
  "Construction",
  "Property management",
  "Other",
] as const;

export const DESIGNER_SYSTEM_TYPES: { id: SystemTypeId; label: string }[] = [
  { id: "internal_assistant", label: "Internal AI assistant" },
  { id: "customer_service", label: "Customer service AI" },
  { id: "phone_assistant", label: "AI phone assistant" },
  { id: "document_processing", label: "Document processing" },
  { id: "operations_automation", label: "Operations automation" },
  { id: "reporting", label: "Reporting assistant" },
  { id: "custom_agent", label: "Custom AI agent" },
];

export const DESIGNER_DATA_SOURCES = [
  "Company documents",
  "CRM",
  "Scheduling system",
  "Email",
  "Internal database",
  "Phone system",
  "Accounting software",
  "Website",
  "Custom API",
] as const;

export const DESIGNER_PRIVACY_CONTROLS = [
  "Role-based permissions",
  "Department restrictions",
  "Audit logs",
  "Human approval",
  "Sensitive-data redaction",
  "Data retention controls",
  "Offline mode",
  "Multi-factor authentication",
] as const;

export const BOOKING_PRIVATE_AI_REASONS = [
  "I need a fully private AI system",
  "I want AI running locally",
  "I need an internal company assistant",
  "I need secure document search",
  "I need to automate private workflows",
  "I am concerned about sending data to public AI",
  "I am not sure which system I need",
] as const;

export const TRUST_INDICATORS = [
  "Private deployment options",
  "Custom business integrations",
  "Role-based access",
  "Human oversight",
  "Ongoing support",
];

export const RELATED_SERVICES = [
  {
    label: "AI Strategy & Implementation",
    href: "/aistrategy",
  },
  { label: "AI Automation", href: "/aiautomation" },
  {
    label: "Web Development & Digital Infrastructure",
    href: "/webdevelopment",
  },
  { label: "CRM & Pipeline Systems", href: "/crmsystems" },
  {
    label: "Business Systems Audit",
    href: "/systemsaudit",
  },
  { label: "Industry Demo Systems", href: "/demos" },
];
