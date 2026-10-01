import type { ProposalSection } from "../lifecycle/types.ts";

export type { ProposalSection };

/** Bump when a prompt or output contract changes; stored on every brief. */
export const PROMPT_VERSION = "call-proposal-v1";
/** A run stuck in extracting/drafting this long is treated as dead. */
export const STALE_RUN_MS = 6 * 60_000;
export const DEFAULT_TEMPLATE_KEY = "business_systems";
/** Total transcript characters sent to the extract step. */
export const INPUT_BUDGET_CHARS = 150_000;

/** The only proposal sections Claude may write. Everything else stays template copy. */
export const TAILORED_KEYS = [
  "executive_summary",
  "current_challenges",
  "desired_outcomes",
  "recommended_system",
  "scope",
  "deliverables",
  "exclusions",
  "phases",
  "timeline",
] as const;
export type TailoredKey = (typeof TAILORED_KEYS)[number];

export type BriefStatus = "extracting" | "drafting" | "ready" | "failed";
export type FailedStage = "extract" | "draft";

/** `verified` is computed server-side (quote found in the transcript), never by the model. */
export type Evidence = { quote: string; call: number; verified: boolean };

export type CallBrief = {
  pain_points: { text: string; evidence: Evidence }[];
  current_tools: { name: string; use: string; issue: string | null; evidence: Evidence }[];
  goals: { text: string; evidence: Evidence }[];
  budget: null | {
    stated: string;
    low_cents: number | null;
    high_cents: number | null;
    confidence: "low" | "medium" | "high";
    evidence: Evidence;
  };
  timeline: null | {
    stated: string;
    target_date: string | null;
    urgency: "low" | "medium" | "high";
    evidence: Evidence;
  };
  decision_makers: { name: string; role: string; evidence: Evidence }[];
  open_questions: string[];
  suggested_template_key: string;
  summary: string;
};

export type BriefWarning = {
  code: "unverified_quotes" | "currency_in_draft";
  detail: string;
};

export type BriefPatch = Partial<{
  status: BriefStatus;
  failedStage: FailedStage | null;
  error: string;
  extraction: CallBrief;
  recordingIds: string[];
  truncated: boolean;
  templateKey: string;
  termLength: string;
  proposalId: string;
  warnings: BriefWarning[];
  model: string;
  inputTokens: number;
  outputTokens: number;
}>;

export type CallBriefRecord = {
  id: string;
  leadId: string;
  recordingIds: string[];
  status: BriefStatus;
  failedStage: FailedStage | null;
  error: string;
  extraction: CallBrief | null;
  truncated: boolean;
  templateKey: string | null;
  termLength: string;
  proposalId: string | null;
  warnings: BriefWarning[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  promptVersion: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

/** One linked, transcribed recording, as fed to the extract step. */
export type CallInput = {
  recordingId: string;
  title: string;
  recordedAt: string | null;
  transcript: string;
  segments: { speaker: string; text: string }[];
};

/** Lightweight recording info for the admin panel (no transcript). */
export type CallSummary = { id: string; title: string; recordedAt: string | null };

export type TemplateChoice = { key: string; label: string };

export class RunInProgressError extends Error {
  constructor() {
    super("A draft is already running for this lead.");
    this.name = "RunInProgressError";
  }
}
