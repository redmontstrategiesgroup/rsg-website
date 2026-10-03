/**
 * Pure lead-scoring helpers (no I/O). Safe to unit-test without Next/server deps.
 */

import type { Lead } from "./types";

/**
 * Notification recipients live in ./notify-emails.ts. Re-exported here because
 * this module is the historical import site for them.
 */
export {
  DEFAULT_CONTACT_TO_EMAIL,
  DEFAULT_OWNER_NOTIFY_EMAIL,
  DEFAULT_CONTACT_NOTIFY_EMAILS,
  contactNotifyEmails,
  primaryContactEmail,
} from "./notify-emails.ts";

/**
 * Basic lead scoring (0–100): urgency, fit, clarity, contact completeness,
 * source intent, and a small revenue modifier.
 */
export function scoreLead(lead: Lead): number {
  let score = 0;

  // Urgency: strongest signal.
  switch (lead.timeline) {
    case "Immediately":
      score += 24;
      break;
    case "This month":
      score += 16;
      break;
    case "Next 90 days":
      score += 8;
      break;
  }

  // Fit: industry / use-case alignment.
  const fitSignal = /med spa|aesthetic|wellness|high-ticket|consulting|service/i.test(
    `${lead.industry} ${lead.company}`
  );
  if (fitSignal) score += 18;
  else if (lead.industry) score += 8;

  // Clarity: concrete problem and outcome language.
  const narrative = `${lead.problem} ${lead.improve}`.trim();
  if (lead.problem.length >= 80) score += 12;
  if (/lead|follow.?up|missed call|booking|convert|no.?show|revenue|pipeline/i.test(narrative)) {
    score += 12;
  }

  // Contact completeness.
  let completeness = 0;
  if (lead.phone) completeness += 4;
  if (lead.website) completeness += 4;
  if (lead.preferredContact === "Call" || lead.preferredContact === "Text") completeness += 4;
  if (lead.email) completeness += 4;
  score += completeness;

  // Source intent.
  const sourceIntent = lead.source === "website_connect_page" ? 10 : lead.source === "website_chat" ? 8 : 4;
  score += sourceIntent;

  // Revenue: small modifier only.
  if (lead.yearlyRevenue) {
    const revenue = lead.yearlyRevenue.toLowerCase();
    if (/\$?2m\+|\$?1m\+|\$?500k\+|\$?250k\+|\$?100k\+|high|enterprise/i.test(revenue)) {
      score += 6;
    } else if (/\$?50k|\$?25k|\$?10k|mid|small/i.test(revenue)) {
      score += 2;
    }
  }

  return Math.min(100, score);
}
