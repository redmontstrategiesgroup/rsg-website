/**
 * Client-side attribution capture. UTM parameters are remembered for the
 * session (first touch wins) so a visitor who lands on the homepage from a
 * campaign and later submits the contact form still carries the attribution.
 */

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const STORAGE_KEY = "rsg_utm";

export type Tracking = {
  page_url: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
};

/** Store UTM params from the current URL, first touch wins. Call on page view. */
export function captureUtm(): void {
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    let found = false;
    for (const key of UTM_KEYS) {
      const value = params.get(key)?.slice(0, 200) ?? "";
      if (value) found = true;
      utm[key] = value;
    }
    if (found) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
  } catch {
    /* storage unavailable */
  }
}

/** Attribution snapshot to submit alongside a lead. */
export function getTracking(): Tracking {
  let utm: Partial<Record<(typeof UTM_KEYS)[number], string>> = {};
  try {
    utm = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    /* corrupt storage — submit without attribution */
  }
  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const pick = (key: (typeof UTM_KEYS)[number]) =>
    (params.get(key) ?? utm[key] ?? "").slice(0, 200);

  return {
    page_url:
      typeof window !== "undefined" ? window.location.href.slice(0, 300) : "",
    referrer:
      typeof document !== "undefined" ? document.referrer.slice(0, 300) : "",
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    utm_content: pick("utm_content"),
    utm_term: pick("utm_term"),
  };
}
