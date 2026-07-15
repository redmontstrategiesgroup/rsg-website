import * as Sentry from "@sentry/nextjs";
import { randomUUID } from "node:crypto";

/** Attach a request id and capture exceptions to Sentry when configured. */
export function requestId(existing?: string | null): string {
  return existing?.slice(0, 64) || randomUUID();
}

export function captureException(
  err: unknown,
  context?: Record<string, unknown>
): void {
  console.error(err);
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context) {
        for (const [k, v] of Object.entries(context)) {
          scope.setExtra(k, v);
        }
      }
      Sentry.captureException(err);
    });
  }
}

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: Record<string, unknown>
): void {
  if (level === "error") console.error(message, context);
  else if (level === "warning") console.warn(message, context);
  else console.info(message, context);

  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context) {
        for (const [k, v] of Object.entries(context)) {
          scope.setExtra(k, v);
        }
      }
      Sentry.captureMessage(message, level);
    });
  }
}
