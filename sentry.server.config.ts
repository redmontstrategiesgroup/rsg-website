import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
    enabled: Boolean(dsn),
    // Never attach cookies/headers/user IP or request bodies to events — this
    // app carries lead and client PII and none of it belongs in error reports.
    sendDefaultPii: false,
  });
}
