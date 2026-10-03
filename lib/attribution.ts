import { cookies } from "next/headers";
import type { FirstTouch } from "@/lib/types";
import { FIRST_TOUCH_COOKIE, parseFirstTouch } from "@/lib/first-touch";

/**
 * Server-side read of the consent-gated attribution cookies set by
 * lib/tracking.ts and components/CookieConsent.tsx. Read straight from the
 * request rather than trusted from form fields, and ignored entirely unless
 * the visitor accepted cookies (rsg_consent=all).
 */

const VID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

/** Visitor id + first touch for a lead being submitted in this request. */
export async function readAttribution(): Promise<{
  visitorId?: string;
  firstTouch?: FirstTouch;
}> {
  const store = await cookies();
  if (store.get("rsg_consent")?.value !== "all") return {};
  const vid = store.get("rsg_vid")?.value ?? "";
  return {
    visitorId: VID_PATTERN.test(vid) ? vid : undefined,
    firstTouch: parseFirstTouch(store.get(FIRST_TOUCH_COOKIE)?.value),
  };
}
