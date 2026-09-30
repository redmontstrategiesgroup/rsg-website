/**
 * Background scheduling from intake. No top-level Next imports, so the gate is
 * unit-testable under plain node.
 */

export function shouldAnalyze(
  r: { duplicate: boolean; storedInDatabase: boolean; leadId?: string },
  env: Record<string, string | undefined> = process.env,
): boolean {
  return !r.duplicate && r.storedInDatabase && Boolean(r.leadId) && Boolean(env.ANTHROPIC_API_KEY);
}

/**
 * Run the analysis after the response is sent (Next `after()`), or
 * fire-and-forget when called outside a request scope. Never throws.
 */
export async function scheduleLeadAnalysis(leadId: string): Promise<void> {
  const run = async () => {
    try {
      const { runLeadAnalysis } = await import("./index.ts");
      const r = await runLeadAnalysis(leadId);
      if (!r.ok) {
        console.warn("[lead-ai] analysis did not complete", {
          leadId,
          reason: r.reason,
          error: r.error,
        });
      }
    } catch (err) {
      console.error("[lead-ai] background analysis crashed", {
        leadId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };
  try {
    const { after } = await import("next/server");
    after(run);
  } catch {
    void run();
  }
}
