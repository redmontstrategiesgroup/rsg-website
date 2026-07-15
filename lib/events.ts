/**
 * Provider-agnostic analytics events. No vendor is hardcoded — the dispatcher
 * forwards to whichever platform is present on the page:
 *
 *   - `window.rsgTrack(name, props)` — custom hook point (wire anything here)
 *   - Google Analytics 4 (`gtag`) or Google Tag Manager (`dataLayer`)
 *   - Plausible (`plausible`)
 *   - PostHog (`posthog`)
 *
 * Add a provider by dropping its snippet into the site — events flow
 * automatically. Events also log to the console in development.
 */

export type EventName =
  | "book_strategy_call_click"
  | "business_systems_audit_click"
  | "service_page_cta_click"
  | "demo_cta_click"
  | "contact_form_start"
  | "contact_form_submit"
  | "chatbot_open"
  | "chatbot_qualified_lead"
  | "thank_you_page_view"
  | "demo_launch_click"
  | "demo_cta_click";

type EventProps = Record<string, string>;

type AnalyticsWindow = Window & {
  rsgTrack?: (name: string, props: EventProps) => void;
  gtag?: (command: "event", name: string, props: EventProps) => void;
  dataLayer?: { push: (entry: Record<string, unknown>) => void };
  plausible?: (name: string, options?: { props: EventProps }) => void;
  posthog?: { capture?: (name: string, props: EventProps) => void };
};

export function trackEvent(name: EventName, props: EventProps = {}): void {
  if (typeof window === "undefined") return;
  const w = window as AnalyticsWindow;
  try {
    w.rsgTrack?.(name, props);
    if (w.gtag) w.gtag("event", name, props);
    else w.dataLayer?.push({ event: name, ...props });
    w.plausible?.(name, { props });
    w.posthog?.capture?.(name, props);
    if (process.env.NODE_ENV !== "production") {
      console.debug("[rsg event]", name, props);
    }
  } catch {
    /* analytics must never break the page */
  }
}
