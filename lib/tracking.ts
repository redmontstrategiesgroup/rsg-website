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
const LANDING_KEY = "rsg_landing";
const FIRST_TOUCH_COOKIE = "rsg_ft";
const NINETY_DAYS = 60 * 60 * 24 * 90;

export type Tracking = {
  page_url: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
};

/** Referrer host, "" when direct or from this site. */
function externalReferrerHost(): string {
  try {
    if (!document.referrer) return "";
    const host = new URL(document.referrer).host;
    return host === window.location.host ? "" : host.slice(0, 200);
  } catch {
    return "";
  }
}

/** Store UTM params from the current URL, first touch wins. Call on page view. */
export function captureUtm(): void {
  try {
    // The session's entry page, so a first-touch cookie written after a
    // mid-visit consent still records where the visit actually began.
    if (!sessionStorage.getItem(LANDING_KEY)) {
      sessionStorage.setItem(
        LANDING_KEY,
        JSON.stringify({
          l: window.location.pathname.slice(0, 200),
          r: externalReferrerHost(),
        })
      );
    }
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
    /* corrupt storage: submit without attribution */
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

/**
 * Write the 90-day first-touch cookie (rsg_ft) from this session's entry
 * page and UTMs. Only call once the visitor has accepted cookies; a no-op
 * when the cookie already exists, so the first visit is never overwritten.
 */
export function saveFirstTouch(): void {
  try {
    if (document.cookie.split("; ").some((c) => c.startsWith(`${FIRST_TOUCH_COOKIE}=`))) {
      return;
    }
    const utm = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
    const landing = JSON.parse(sessionStorage.getItem(LANDING_KEY) ?? "{}");
    const value = encodeURIComponent(
      JSON.stringify({
        s: utm.utm_source ?? "",
        m: utm.utm_medium ?? "",
        c: utm.utm_campaign ?? "",
        n: utm.utm_content ?? "",
        t: utm.utm_term ?? "",
        r: landing.r ?? externalReferrerHost(),
        l: landing.l ?? window.location.pathname.slice(0, 200),
        a: new Date().toISOString(),
      })
    );
    document.cookie = `${FIRST_TOUCH_COOKIE}=${value}; max-age=${NINETY_DAYS}; path=/; SameSite=Lax`;
  } catch {
    /* storage or cookies unavailable */
  }
}
