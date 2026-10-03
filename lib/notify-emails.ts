/**
 * Who gets notified when a visitor completes a form on the site.
 *
 * One list, read by every notification path (leads, subscribers, managed
 * services, scheduling), so adding or changing a recipient is a one-line
 * change and no path is left quietly mailing an older address.
 */

/** Shared team inbox. Also the reply-to and calendar organizer address. */
export const DEFAULT_CONTACT_TO_EMAIL = "contact@redmontstrategiesgroup.com";

/** Owner's inbox: receives a copy of every form submission. */
export const DEFAULT_OWNER_NOTIFY_EMAIL =
  "josephoday@redmontstrategiesgroup.com";

export const DEFAULT_CONTACT_NOTIFY_EMAILS: readonly string[] = [
  DEFAULT_CONTACT_TO_EMAIL,
  DEFAULT_OWNER_NOTIFY_EMAIL,
];

/**
 * Split a configured recipient string on commas, semicolons, or whitespace.
 * Blanks and obvious non-addresses are dropped; duplicates are removed
 * case-insensitively so a repeated address can't double-send.
 */
export function parseEmailList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const email = part.trim();
    // Cheap shape check only: Resend is the authority on deliverability.
    if (!email || !email.includes("@") || email.startsWith("@")) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

/**
 * Every address that should receive form notifications. `CONTACT_TO_EMAIL`
 * (comma-separated) replaces the defaults entirely, so recipients can be
 * redirected from the Vercel dashboard without a deploy.
 */
export function contactNotifyEmails(): string[] {
  const configured = parseEmailList(process.env.CONTACT_TO_EMAIL);
  return configured.length ? configured : [...DEFAULT_CONTACT_NOTIFY_EMAILS];
}

/**
 * Single address for headers that accept exactly one (reply-to, iCal
 * organizer). Always the first configured recipient.
 */
export function primaryContactEmail(): string {
  return contactNotifyEmails()[0] ?? DEFAULT_CONTACT_TO_EMAIL;
}
