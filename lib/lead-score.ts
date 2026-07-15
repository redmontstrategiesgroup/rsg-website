/**
 * Pure lead-scoring helpers (no I/O). Safe to unit-test without Next/server deps.
 */

import type { Lead } from "./types";

/** Default inbox for lead notifications when CONTACT_TO_EMAIL is unset. */
export const DEFAULT_CONTACT_TO_EMAIL = "contact@redmontstrategiesgroup.com";

/**
 * Basic lead scoring (0–100): buying timeline is the strongest signal,
 * followed by industry fit and how concretely the problem is described.
 */
export function scoreLead(lead: Lead): number {
  let score = 0;

  switch (lead.timeline) {
    case "Immediately":
      score += 40;
      break;
    case "This month":
      score += 30;
      break;
    case "Next 90 days":
      score += 15;
      break;
  }

  if (lead.industry) {
    score += /med spa|aesthetic|dental|high-ticket/i.test(lead.industry)
      ? 20
      : 10;
  }

  const narrative = `${lead.problem} ${lead.improve}`;
  if (lead.problem.length >= 80) score += 10;
  if (/lead|follow.?up|missed call|booking|convert|no.?show/i.test(narrative)) {
    score += 10;
  }

  if (lead.phone) score += 5;
  if (lead.website) score += 5;
  if (lead.preferredContact === "Call" || lead.preferredContact === "Text") {
    score += 5;
  }
  if (lead.utmSource) score += 5;

  return Math.min(100, score);
}
