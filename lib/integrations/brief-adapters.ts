import type { BriefPayload } from "@/lib/briefs/schema";

/** Provider-neutral contract for Gmail, inbound-email, calendar, and automation adapters. */
export interface BriefIngestionAdapter<TInput = unknown> {
  readonly type: "gmail" | "email" | "google_calendar" | "webhook" | "automation";
  verify(input: TInput): Promise<boolean>;
  normalize(input: TInput): Promise<BriefPayload>;
}

export type EmailAdapterCredentials = {
  provider: "gmail" | "resend" | "postmark" | "sendgrid";
  webhookSigningSecret: string;
  allowedSenders: string[];
  destinationAddress: string;
};

export type CalendarAdapterCredentials = {
  provider: "google_calendar";
  calendarId: string;
  oauthClientId: string;
  oauthClientSecret: string;
  refreshToken: string;
};

// Local IDE/connector OAuth tokens are intentionally not reused by the
// deployed website. Production adapters must receive their own server-side
// OAuth or signed-webhook credentials before an integration can report
// "connected".
