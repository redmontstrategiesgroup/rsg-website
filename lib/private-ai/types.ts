/** Types for Custom Private AI Systems marketing + opportunity pipeline. */

export const PRIVATE_AI_PIPELINE_STAGES = [
  "new_inquiry",
  "discovery_required",
  "security_review",
  "technical_assessment",
  "architecture_proposed",
  "proposal_sent",
  "pilot_development",
  "pilot_review",
  "production_planning",
  "active_build",
  "deployed",
  "ongoing_support",
  "not_moving_forward",
] as const;

export type PrivateAiPipelineStage = (typeof PRIVATE_AI_PIPELINE_STAGES)[number];

export const PRIVATE_AI_STAGE_LABELS: Record<PrivateAiPipelineStage, string> = {
  new_inquiry: "New Inquiry",
  discovery_required: "Discovery Required",
  security_review: "Security Review",
  technical_assessment: "Technical Assessment",
  architecture_proposed: "Architecture Proposed",
  proposal_sent: "Proposal Sent",
  pilot_development: "Pilot Development",
  pilot_review: "Pilot Review",
  production_planning: "Production Planning",
  active_build: "Active Build",
  deployed: "Deployed",
  ongoing_support: "Ongoing Support",
  not_moving_forward: "Not Moving Forward",
};

export type DeploymentModelId =
  | "fully_local"
  | "on_premise"
  | "private_cloud"
  | "hybrid"
  | "secure_managed";

export type SystemTypeId =
  | "internal_assistant"
  | "customer_service"
  | "phone_assistant"
  | "document_processing"
  | "operations_automation"
  | "reporting"
  | "custom_agent";

export type DesignerConfig = {
  businessType: string;
  systemType: SystemTypeId;
  deployment: DeploymentModelId;
  dataSources: string[];
  privacyControls: string[];
};

export type SimulatedArchitecture = {
  recommendedDeployment: string;
  coreComponents: string[];
  integrations: string[];
  securityControls: string[];
  exampleRoles: string[];
  exampleWorkflow: string[];
  implementationPhases: string[];
  nextStep: string;
  disclaimer: string;
};

export type PrivateAiOpportunity = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: PrivateAiPipelineStage;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  industry: string;
  employees: string;
  locations: string;
  currentSoftware: string;
  privacyConcerns: string;
  timeline: string;
  notes: string;
  owner: string;
  adminNotes: string;
  leadId?: string;
  config: DesignerConfig;
  architecture: SimulatedArchitecture;
  deploymentPreference: DeploymentModelId;
  privacyLevel: string;
  existingInfrastructure: string;
  dataTypes: string;
  requiredIntegrations: string;
  estimatedUsers: string;
  internetAvailability: string;
  hardwareAvailability: string;
  complianceConsiderations: string;
  approvalRequirements: string;
  budgetRange: string;
  technicalNotes: string;
  securityNotes: string;
  activity: { at: string; text: string; by?: string }[];
};
