/**
 * Turns the model's draft into the final email text. The model never writes
 * links: it writes BOOKING_TOKEN, which becomes the real booking URL here, and
 * any other URL or email address it produced is removed. The signature is
 * appended by code so it is always correct.
 */

export const BOOKING_TOKEN = "{{BOOKING_LINK}}";
export const DEFAULT_SIGNATURE = "Joseph\nRedmont Strategies Group";

/** Signature from env: literal "\n" sequences become line breaks; blank -> default. */
export function resolveSignature(raw: string | undefined): string {
  const s = raw?.replace(/\\n/g, "\n").trim();
  return s || DEFAULT_SIGNATURE;
}

// Stops before trailing punctuation so "www.x.com, or" keeps its comma.
const URL_RE = /\b(?:https?:\/\/|www\.)(?:[^\s)>\]]*[^\s)>\].,;:!?])/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// Strips bare domains with allowed TLDs, keeping trailing punctuation outside.
// Matches optional paths after domain. Negative lookahead ensures TLD is not part of a longer word.
const BARE_DOMAIN_RE = /\b[a-z0-9-]+\.(?:com|net|org|io|co|ly|me|app|biz|info|xyz|us|ai|dev)(?![a-z0-9-])(?:\/[^\s)>\]]*[^\s)>\].,;:!?])?/gi;

const WS_TAIL = (t: string) =>
  t
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Removes URLs, email addresses and bare domains, then normalizes whitespace. */
export function stripLinks(text: string): string {
  return WS_TAIL(
    text
      .replace(/\r\n/g, "\n")
      .replace(URL_RE, "")
      .replace(EMAIL_RE, "")
      .replace(BARE_DOMAIN_RE, ""),
  );
}

export function composeDraft(
  body: string,
  opts: { bookingUrl: string; signature: string },
): string {
  const cleaned = WS_TAIL(
    body
      .replace(/\r\n/g, "\n")
      .replace(URL_RE, "")
      .replace(EMAIL_RE, "")
      .replace(BARE_DOMAIN_RE, "")
      .split(BOOKING_TOKEN)
      .join(opts.bookingUrl),
  );
  return `${cleaned}\n\n${opts.signature.trim()}`;
}

/** Subject line: no links, no booking token, one line, at most 160 chars. */
export function composeSubject(subject: string): string {
  return stripLinks(subject)
    .split(BOOKING_TOKEN)
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160)
    .trim();
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Minimal HTML alternative for the plain-text reply. */
export function toReplyHtml(text: string): string {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin: 0 0 14px;">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.5; color: #111;">${paragraphs}</div>`;
}
