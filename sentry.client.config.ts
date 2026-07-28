import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    enabled: Boolean(dsn),
    // Do not attach user IP / identifying request data to events.
    sendDefaultPii: false,
    // Session Replay is sampled on errors; keep it strictly anonymized so form
    // fields (lead name/email, portal content) can never be reconstructed from
    // a replay. These are the SDK defaults — pinned here so a future config
    // edit can't silently un-mask PII.
    integrations: [
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
  });
}
