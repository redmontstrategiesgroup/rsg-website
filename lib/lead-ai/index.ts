import { generateStructured, type StructuredSchema } from "@/lib/ai/proxy";
import { siteUrl } from "@/lib/lifecycle/core";
import { getLeadById } from "@/lib/store";
import { analyzeLead, type AnalyzeDeps, type AnalyzeResult } from "./analyze.ts";
import { DEFAULT_SIGNATURE } from "./compose.ts";
import { insertInsight, updateLeadAi } from "./db.ts";
import { LEAD_AI_TOOL } from "./schema.ts";

/**
 * Production wiring for lead AI. Pure logic lives in analyze.ts / reply.ts;
 * this file binds it to Supabase, the Anthropic proxy, and Resend.
 */

export const LEAD_AI_MODEL = process.env.LEAD_AI_MODEL ?? "claude-sonnet-5";

export function leadAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function replySignature(): string {
  return process.env.LEAD_REPLY_SIGNATURE?.replace(/\n/g, "\n") || DEFAULT_SIGNATURE;
}

function analyzeDeps(): AnalyzeDeps {
  return {
    loadLead: getLeadById,
    generate: async ({ system, message }) => {
      let usage = { inputTokens: 0, outputTokens: 0 };
      const output = await generateStructured<unknown>({
        tenantId: "rsg-lead-ai",
        app: "lead_ai",
        system,
        input: message,
        schema: LEAD_AI_TOOL as StructuredSchema,
        model: LEAD_AI_MODEL,
        maxTokens: 1500,
        requestOptions: { timeout: 30_000, maxRetries: 1 },
        onUsage: (u) => {
          usage = { inputTokens: u.inputTokens, outputTokens: u.outputTokens };
        },
      });
      return { output, model: LEAD_AI_MODEL, ...usage };
    },
    insertInsight,
    updateLeadAi,
    model: LEAD_AI_MODEL,
    bookingUrl: `${siteUrl()}/book`,
    signature: replySignature(),
  };
}

export function runLeadAnalysis(leadId: string): Promise<AnalyzeResult> {
  return analyzeLead(leadId, analyzeDeps());
}
