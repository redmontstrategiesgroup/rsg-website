/**
 * Future integration interfaces — not connected.
 * Do not call these as live providers.
 */

export type CalendarProvider = "google_calendar" | "microsoft_outlook" | "apple";

export type ConferencingProvider = "zoom" | "google_meet" | "microsoft_teams";

export type EmailProvider = "resend" | "sendgrid" | "postmark" | "gmail";

export type SmsProvider = "twilio";

export type CrmProvider = "hubspot" | "salesforce";

export interface CalendarIntegrationAdapter {
  provider: CalendarProvider;
  status: "not_connected" | "connected" | "error" | "disabled";
  createEvent?(input: unknown): Promise<{ externalId: string }>;
  updateEvent?(externalId: string, input: unknown): Promise<void>;
  deleteEvent?(externalId: string): Promise<void>;
}

export interface ConferencingAdapter {
  provider: ConferencingProvider;
  status: "not_connected" | "connected" | "error" | "disabled";
  createMeeting?(input: unknown): Promise<{ joinUrl: string }>;
}

export interface SmsAdapter {
  provider: SmsProvider;
  status: "not_connected" | "connected" | "error" | "disabled";
  send?(to: string, body: string): Promise<{ id: string }>;
}

export const INTEGRATION_PLACEHOLDERS: {
  provider: string;
  category: string;
  status: "not_connected";
}[] = [
  { provider: "Google Calendar", category: "calendar", status: "not_connected" },
  { provider: "Microsoft Outlook", category: "calendar", status: "not_connected" },
  { provider: "Zoom", category: "conferencing", status: "not_connected" },
  { provider: "Google Meet", category: "conferencing", status: "not_connected" },
  { provider: "Microsoft Teams", category: "conferencing", status: "not_connected" },
  { provider: "Twilio SMS", category: "sms", status: "not_connected" },
  { provider: "HubSpot", category: "crm", status: "not_connected" },
  { provider: "Salesforce", category: "crm", status: "not_connected" },
  { provider: "Stripe", category: "payments", status: "not_connected" },
  { provider: "Slack", category: "notifications", status: "not_connected" },
];
