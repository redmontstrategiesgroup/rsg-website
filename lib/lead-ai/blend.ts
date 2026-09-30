/**
 * Score thresholds and the rule-score + Claude-adjustment blend. The single
 * source of the hot/warm cut-offs (lib/leads.ts buckets read these too).
 */

export const HOT_THRESHOLD = 70;
export const WARM_THRESHOLD = 45;
/** Claude may move the rule score by at most this many points either way. */
export const MAX_ADJUSTMENT = 20;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function blendScore(ruleScore: number, adjustment: number): number {
  return clamp(ruleScore + clamp(adjustment, -MAX_ADJUSTMENT, MAX_ADJUSTMENT), 0, 100);
}

export function bucketOf(score: number): "hot" | "warm" | "cold" {
  if (score >= HOT_THRESHOLD) return "hot";
  if (score >= WARM_THRESHOLD) return "warm";
  return "cold";
}

/** True only when a score moves from below hot to hot or above. */
export function crossedIntoHot(before: number, after: number): boolean {
  return before < HOT_THRESHOLD && after >= HOT_THRESHOLD;
}
