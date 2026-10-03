import type { FirstTouch } from "./types.ts";

/**
 * Parser for the rsg_ft first-touch cookie written by lib/tracking.ts. Kept
 * free of Next imports so the test runner can load it directly.
 */

export const FIRST_TOUCH_COOKIE = "rsg_ft";

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max) : "";

/**
 * Decode an rsg_ft cookie value. The cookie is visitor-controlled, so every
 * field is type-checked and length-capped; anything malformed yields
 * undefined rather than a partial record.
 */
export function parseFirstTouch(raw: string | undefined): FirstTouch | undefined {
  if (!raw || raw.length > 3000) return undefined;
  let data: unknown;
  try {
    data = JSON.parse(decodeURIComponent(raw));
  } catch {
    return undefined;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const d = data as Record<string, unknown>;
  const at = str(d.a, 40);
  if (!at || Number.isNaN(Date.parse(at))) return undefined;
  const landingPage = str(d.l, 200);
  return {
    utmSource: str(d.s, 200),
    utmMedium: str(d.m, 200),
    utmCampaign: str(d.c, 200),
    utmContent: str(d.n, 200),
    utmTerm: str(d.t, 200),
    referrer: str(d.r, 200),
    landingPage: landingPage.startsWith("/") ? landingPage : "",
    at: new Date(at).toISOString(),
  };
}
