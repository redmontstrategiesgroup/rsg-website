/**
 * Turns the model's draft into the final email text. The model never writes
 * links: it writes BOOKING_TOKEN, which becomes the real booking URL here, and
 * any other URL or email address it produced is removed. The signature is
 * appended by code so it is always correct.
 */

export const BOOKING_TOKEN = "{{BOOKING_LINK}}";
export const DEFAULT_SIGNATURE = "Joseph\nRedmont Strategies Group";

// Stops before trailing punctuation so "www.x.com, or" keeps its comma.
const URL_RE = /\b(?:https?:\/\/|www\.)(?:[^\s)>\]]*[^\s)>\].,;:!?])/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

export function composeDraft(
  body: string,
  opts: { bookingUrl: string; signature: string },
): string {
  const cleaned = body
    .replace(/\r\n/g, "\n")
    .replace(URL_RE, "")
    .replace(EMAIL_RE, "")
    .split(BOOKING_TOKEN)
    .join(opts.bookingUrl)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${cleaned}\n\n${opts.signature.trim()}`;
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
