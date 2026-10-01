import type { ExtractOutput } from "./schema.ts";
import { DEFAULT_TEMPLATE_KEY, type CallBrief, type Evidence } from "./types.ts";

/** Lowercase, drop apostrophes, turn everything else non-alphanumeric into single spaces. */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/['‘’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Mark each quote verified when it appears in its call's text (or, failing
 * that, any call's). Unverified items are kept and flagged, never dropped.
 */
export function verifyBrief(
  raw: ExtractOutput,
  callTexts: string[],
): { brief: CallBrief; unverified: number } {
  const norm = callTexts.map(normalizeForMatch);
  const all = norm.join(" \n ");
  let unverified = 0;
  const ev = (e: { quote: string; call: number }): Evidence => {
    const q = normalizeForMatch(e.quote);
    const own = norm[e.call - 1];
    const verified = q.length > 0 && ((own !== undefined && own.includes(q)) || all.includes(q));
    if (!verified) unverified++;
    const call = e.call >= 1 && e.call <= Math.max(callTexts.length, 1) ? e.call : 1;
    return { quote: e.quote, call, verified };
  };

  const budget = raw.budget
    ? (() => {
        const { low_cents, high_cents } = raw.budget;
        const swap = low_cents != null && high_cents != null && low_cents > high_cents;
        return {
          ...raw.budget,
          low_cents: swap ? high_cents : low_cents,
          high_cents: swap ? low_cents : high_cents,
          evidence: ev(raw.budget.evidence),
        };
      })()
    : null;

  const brief: CallBrief = {
    pain_points: raw.pain_points.map((p) => ({ text: p.text, evidence: ev(p.evidence) })),
    current_tools: raw.current_tools.map((t) => ({ ...t, evidence: ev(t.evidence) })),
    goals: raw.goals.map((g) => ({ text: g.text, evidence: ev(g.evidence) })),
    budget,
    timeline: raw.timeline ? { ...raw.timeline, evidence: ev(raw.timeline.evidence) } : null,
    decision_makers: raw.decision_makers.map((d) => ({ ...d, evidence: ev(d.evidence) })),
    open_questions: raw.open_questions,
    suggested_template_key: raw.suggested_template_key,
    summary: raw.summary,
  };
  return { brief, unverified };
}

export function resolveTemplateKey(key: string, valid: string[]): string {
  if (valid.includes(key)) return key;
  if (valid.includes(DEFAULT_TEMPLATE_KEY)) return DEFAULT_TEMPLATE_KEY;
  return valid[0] ?? DEFAULT_TEMPLATE_KEY;
}
