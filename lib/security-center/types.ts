/**
 * Security Center domain types (safe to import from client & server).
 * Backed by the security_* tables (supabase/migrations/20260717090000) with a
 * local file-store fallback in dev, mirroring lib/store.ts.
 */

import type { AdminRole } from "@/lib/types";

/* ------------------------------ Incidents ------------------------------ */

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type IncidentStatus =
  | "open"
  | "contained"
  | "monitoring"
  | "resolved"
  | "closed";

export type IncidentTimelineKind =
  | "detected"
  | "containment"
  | "credential_rotation"
  | "isolation"
  | "log_preservation"
  | "notification"
  | "restoration"
  | "note"
  | "resolution"
  | "follow_up";

export type IncidentTimelineEntry = {
  at: string; // ISO
  actor: string;
  kind: IncidentTimelineKind;
  text: string;
};

export type SecurityIncident = {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  owner: string;
  systemsAffected: string[];
  timeline: IncidentTimelineEntry[];
  detectedAt: string;
  resolvedAt?: string | null;
  followUpAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

/* ------------------------------- Vendors ------------------------------- */

export type VendorAgreementStatus =
  | "not_documented"
  | "requested"
  | "in_review"
  | "terms_accepted"
  | "dpa_signed"
  | "expired"
  | "terminated";

export type VendorStatus = "active" | "under_review" | "offboarding" | "removed";

export type VendorRiskLevel = "low" | "medium" | "high";

export type VendorRecord = {
  id: string;
  name: string;
  service: string;
  purpose: string;
  dataCategories: string[];
  environment: string;
  hostingRegion?: string | null;
  contractOwner?: string | null;
  securityDocsUrl?: string | null;
  agreementStatus: VendorAgreementStatus;
  renewalDate?: string | null; // YYYY-MM-DD
  subprocessors?: string | null;
  accessLevel?: string | null;
  lastReviewDate?: string | null; // YYYY-MM-DD
  riskLevel: VendorRiskLevel;
  removalProcedure?: string | null;
  notes?: string | null;
  status: VendorStatus;
  createdAt: string;
  updatedAt: string;
};

/* --------------------------- Retention rules --------------------------- */

export type RetentionAction = "manual_review" | "anonymize" | "archive" | "delete";

export type RetentionStatus = "draft" | "active" | "suspended";

export type RetentionRule = {
  id: string;
  dataCategory: string;
  label: string;
  /** Human-readable schedule, e.g. "24 months after last activity". */
  retentionPeriod: string;
  retentionDays?: number | null;
  actionAtExpiry: RetentionAction;
  legalHold: boolean;
  notes?: string | null;
  status: RetentionStatus;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

/* ---------------------------- AI approvals ----------------------------- */

export type AiApprovalStatus =
  | "drafted"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "executed"
  | "failed"
  | "escalated"
  | "expired";

export type AiApprovalRisk = "low" | "medium" | "high" | "critical";

export type AiApproval = {
  id: string;
  actionType: string;
  title: string;
  /** The AI-drafted content under review (email body, proposal, etc.). */
  content: string;
  reason: string;
  dataSources: string[];
  recordsAffected: string[];
  riskLevel: AiApprovalRisk;
  status: AiApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  expiresAt?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  executedAt?: string | null;
  executionResult?: string | null;
  createdAt: string;
  updatedAt: string;
};

/* ---------------------------- Security tests --------------------------- */

export type SecurityTestResult = "not_run" | "pass" | "fail" | "partial";

export type SecurityTestRetest = "none" | "required" | "scheduled" | "passed" | "failed";

export type SecurityTest = {
  id: string;
  name: string;
  category: string;
  target: string;
  expected: string;
  actual: string;
  result: SecurityTestResult;
  severity?: "info" | "low" | "medium" | "high" | "critical" | null;
  evidence?: string | null;
  remediation?: string | null;
  retestStatus: SecurityTestRetest;
  lastRunAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

/* --------------------------- Security settings ------------------------- */

export type SecurityPackageId =
  | "core"
  | "advanced"
  | "responsible_ai"
  | "private_ai";

export type SecurityPackagePricing = {
  id: SecurityPackageId;
  /** Admin-set starting price display string, e.g. "Starting at $1,800".
   *  Empty string = no price displayed on the marketing site. */
  startingPrice: string;
};

export type SecuritySettings = {
  /** Roles that must have MFA enabled before permission-gated admin actions. */
  mfaRequiredRoles: AdminRole[];
  /** Emergency disable for AI-powered endpoints (chat, briefs, private-AI). */
  aiPaused: boolean;
  aiPausedReason: string;
  /** Hours before an unactioned AI approval request expires. */
  approvalExpiryHours: number;
  /** Admin-editable starting prices for security packages ("" = hidden). */
  packages: SecurityPackagePricing[];
};

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  mfaRequiredRoles: [],
  aiPaused: false,
  aiPausedReason: "",
  approvalExpiryHours: 72,
  packages: [
    { id: "core", startingPrice: "" },
    { id: "advanced", startingPrice: "" },
    { id: "responsible_ai", startingPrice: "" },
    { id: "private_ai", startingPrice: "" },
  ],
};

/* ------------------------------ Overview ------------------------------- */

export type SecurityStatusLevel =
  | "secure"
  | "review_recommended"
  | "action_required"
  | "critical";

export type SecurityIndicator = {
  key: string;
  label: string;
  /** Real measured value, or a clear "unavailable" marker — never fabricated. */
  value: string;
  detail?: string;
  status: SecurityStatusLevel;
};

export type EnvironmentCheck = {
  key: string;
  label: string;
  value: string;
  status: SecurityStatusLevel;
  detail?: string;
};

export type SecurityOverview = {
  generatedAt: string;
  /** True when any displayed number comes from seeded demo data. */
  usingDemoData: boolean;
  indicators: SecurityIndicator[];
  environment: EnvironmentCheck[];
  /** Counts backing the indicators (for drill-down UI). */
  counts: {
    admins: number;
    adminsWithMfa: number;
    failedLogins7d: number;
    permissionChanges30d: number;
    openApprovals: number;
    openIncidents: number;
    failedTests: number;
    vendorsNeedingReview: number;
    activeRetentionRules: number;
    recentHighRiskAiActions: AiApproval[];
  };
};
