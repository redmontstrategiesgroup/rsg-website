/**
 * "Known visitor": someone who has already given us their email (a form, a
 * booking, the chat) or arrived from one of our emails. Known visitors never
 * see the newsletter popup again.
 *
 * Deliberately per browser and non-identifying: the flag is a localStorage
 * value with no id in it, so it needs no consent and leaks nothing on a shared
 * device. Cross-device memory comes from links in our own emails, never from
 * IP addresses (shared networks would suppress the popup for strangers).
 */

/** Shared with EmailCapture, which also writes "dismissed:<ts>" here. */
export const EMAIL_CAPTURE_KEY = "rsg_email_capture";

/** Query param appended to site links in emails sent to a lead. */
export const KNOWN_PARAM = "known";

/**
 * Pages only reachable through a private link we emailed (booking manage,
 * proposals, contracts, invoices, portal, questionnaires). Landing on one
 * proves the visitor is a lead or client.
 */
const KNOWN_PATH_RE =
  /^\/(?:booking\/(?:manage|confirmed)|assessment\/[^/]+|prepare\/[^/]+|proposals?\/[^/]+|agreement\/[^/]+|pay\/[^/]+|portal)(?:\/|$)/;

export function isKnownVisitorPath(pathname: string): boolean {
  return KNOWN_PATH_RE.test(pathname);
}

/** Tag a site URL for an outbound email so the landing page marks the visitor. */
export function withKnownMarker(url: string): string {
  const u = new URL(url);
  u.searchParams.set(KNOWN_PARAM, "1");
  return u.toString();
}

/** Browser only. Suppresses the newsletter popup on this browser for good. */
export function markKnownVisitor(): void {
  try {
    localStorage.setItem(EMAIL_CAPTURE_KEY, "subscribed");
  } catch {
    /* storage unavailable: the popup's own snooze still applies */
  }
}
