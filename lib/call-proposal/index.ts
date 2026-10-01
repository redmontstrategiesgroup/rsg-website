import { generateStructured, type StructuredSchema } from "@/lib/ai/proxy";
import { createProposal, updateProposalContent } from "@/lib/lifecycle/proposals";
import { PROPOSAL_TEMPLATES, buildProposalSections } from "@/lib/lifecycle/proposal-templates";
import { getLeadById } from "@/lib/store";
import {
  claimRetry,
  failStaleRuns,
  findDraftProposalForBrief,
  getBrief,
  insertBrief,
  listBriefs,
  listCallSummaries,
  loadCalls,
  loadDraftProposalSections,
  updateBrief,
} from "./db.ts";
import { retryDraft, runCallProposal, type PipelineDeps, type RunResult } from "./pipeline.ts";
import { DRAFT_TOOL, EXTRACT_TOOL } from "./schema.ts";
import {
  STALE_RUN_MS,
  TAILORED_KEYS,
  type CallBriefRecord,
  type CallSummary,
} from "./types.ts";

/**
 * Production wiring for Call → Proposal. Pure logic lives in pipeline.ts;
 * this binds it to Supabase, the Anthropic proxy and the proposal system.
 */

export const CALL_PROPOSAL_MODEL =
  process.env.PROPOSAL_AI_MODEL ?? process.env.AI_MODEL ?? "claude-sonnet-5";

export function callProposalEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const TAILORED = new Set<string>(TAILORED_KEYS);

function deps(): PipelineDeps {
  return {
    loadLead: getLeadById,
    loadCalls,
    templates: Object.values(PROPOSAL_TEMPLATES).map((t) => ({ key: t.key, label: t.label })),
    templateSections: (templateKey, businessName) =>
      buildProposalSections(templateKey, {
        businessName,
        challenges: [],
        outcomes: [],
        totalCents: 0,
        depositCents: 0,
      }).filter((s) => TAILORED.has(s.key)),
    generate: async ({ stage, system, message }) => {
      let usage = { inputTokens: 0, outputTokens: 0 };
      const output = await generateStructured<unknown>({
        tenantId: "rsg-internal",
        app: "call-proposal",
        system,
        input: message,
        schema: (stage === "extract" ? EXTRACT_TOOL : DRAFT_TOOL) as StructuredSchema,
        model: CALL_PROPOSAL_MODEL,
        maxTokens: stage === "extract" ? 4096 : 8192,
        // Two stages must fit in the routes' 300 s maxDuration.
        requestOptions: { timeout: 120_000, maxRetries: 0 },
        onUsage: (u) => {
          usage = { inputTokens: u.inputTokens, outputTokens: u.outputTokens };
        },
      });
      return { output, model: CALL_PROPOSAL_MODEL, ...usage };
    },
    failStaleRuns,
    insertBrief,
    updateBrief,
    getBrief,
    loadProposalSections: loadDraftProposalSections,
    claimRetry,
    createDraftProposal: async (input) => {
      // Idempotent per brief: a retry after a partial failure reuses the existing draft.
      const existing = await findDraftProposalForBrief(input.briefId);
      if (existing) return existing;
      const { proposal } = await createProposal({
        leadId: input.leadId,
        templateKey: input.templateKey,
        title: input.title,
        businessName: input.businessName,
        challenges: input.challenges,
        outcomes: input.outcomes,
        totalCents: 0,
        depositCents: 0,
        expiresInDays: 30,
        createdBy: input.createdBy,
        callBriefId: input.briefId,
      });
      return { id: proposal.id, sections: proposal.sections };
    },
    saveProposalSections: async (proposalId, sections) => {
      await updateProposalContent(proposalId, { sections });
    },
  };
}

export function draftProposalForLead(leadId: string, admin: string): Promise<RunResult> {
  return runCallProposal(leadId, admin, deps());
}

export function retryProposalDraft(briefId: string): Promise<RunResult> {
  return retryDraft(briefId, deps());
}

export type BriefListing = {
  briefs: CallBriefRecord[];
  calls: CallSummary[];
  readyCalls: number;
  enabled: boolean;
};

/** Panel data for one lead. Also clears runs left stuck by a killed function. */
export async function briefListing(leadId: string): Promise<BriefListing> {
  await failStaleRuns(leadId, STALE_RUN_MS);
  const [briefs, calls] = await Promise.all([listBriefs(leadId), listCallSummaries(leadId)]);
  return { briefs, calls, readyCalls: calls.length, enabled: callProposalEnabled() };
}

export { getBrief, listCallSummaries };
