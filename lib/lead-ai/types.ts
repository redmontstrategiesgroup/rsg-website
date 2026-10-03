/**
 * Shared types for Claude lead analysis (score adjustment + drafted reply).
 * No imports: safe for pure modules and client components alike.
 */

export const RED_FLAGS = [
  "spam",
  "vendor_pitch",
  "job_seeker",
  "student",
  "out_of_scope",
] as const;
export type RedFlag = (typeof RED_FLAGS)[number];

/** Flags for which no reply is drafted, whatever the model returned. */
export const NO_DRAFT_FLAGS: readonly RedFlag[] = ["spam", "vendor_pitch"];

/** Validated model output (snake_case: it mirrors the tool schema). */
export type LeadAiOutput = {
  ai_fit_score: number;
  adjustment: number;
  rationale: string;
  signals: { positive: string[]; negative: string[] };
  red_flags: RedFlag[];
  draft: { subject: string; body: string } | null;
};

/** One lead_ai_insights row, as the app and the admin UI see it. */
export type LeadInsight = {
  id: string;
  leadId: string;
  createdAt: string;
  model: string;
  promptVersion: string;
  status: "ok" | "failed";
  error: string | null;
  aiFitScore: number | null;
  /** Already clamped to ±MAX_ADJUSTMENT. */
  adjustment: number | null;
  rationale: string | null;
  signals: { positive: string[]; negative: string[] } | null;
  redFlags: RedFlag[];
  draftSubject: string | null;
  /** Final text: booking link and signature already applied. */
  draftBody: string | null;
  sentAt: string | null;
  sentBy: string | null;
  sentSubject: string | null;
  sentBody: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
};

/** What analyzeLead writes; the DB fills id/createdAt; send fields start null. */
export type NewInsight = Omit<
  LeadInsight,
  "id" | "createdAt" | "sentAt" | "sentBy" | "sentSubject" | "sentBody"
>;
