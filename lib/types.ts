/** Shared portal domain types (safe to import from client & server). */

export type SystemStatus = "live" | "optimizing" | "building" | "paused";

export type PortalSystem = {
  name: string;
  category: string;
  status: SystemStatus;
  description: string;
  /** Headline throughput metric, e.g. "1,284 msgs / mo". */
  throughput: string;
  uptime: number; // percent
};

export type PortalMetric = {
  key: string;
  label: string;
  value: number;
  /** Rendering hint. */
  format: "number" | "currency" | "percent" | "duration";
  /** e.g. "+18% MoM" */
  delta?: string;
  hint?: string;
};

export type PortalProject = {
  name: string;
  phase: "Discovery" | "Build" | "Launch" | "Optimize" | "Complete";
  progress: number; // 0-100
  due: string;
  owner: string;
};

export type ActivityKind = "booking" | "lead" | "system" | "report" | "message";

export type PortalActivity = {
  kind: ActivityKind;
  text: string;
  time: string;
};

export type PortalDeliverable = {
  name: string;
  type: string;
  date: string;
  status: "Ready" | "In review" | "Scheduled";
};

export type PortalInvoice = {
  id: string;
  amount: number;
  date: string;
  status: "Paid" | "Due" | "Upcoming";
};

export type ClientPublic = {
  id: string;
  name: string;
  email: string;
  company: string;
  plan: string;
  since: string;
  strategist: string;
  metrics: PortalMetric[];
  systems: PortalSystem[];
  projects: PortalProject[];
  activity: PortalActivity[];
  deliverables: PortalDeliverable[];
  invoices: PortalInvoice[];
};

export type ClientRecord = ClientPublic & {
  /** scrypt "salt:digest" — never sent to the client. */
  passwordHash?: string;
};

export type AdminRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
};

/** Fields an admin may edit on a client. */
export type ClientPatch = {
  name?: string;
  email?: string;
  company?: string;
  plan?: string;
  since?: string;
  strategist?: string;
  password?: string;
  metrics?: {
    key: string;
    label?: string;
    value: number;
    delta?: string;
    hint?: string;
  }[];
};

export type Lead = {
  name: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  /** Biggest problem right now, in the prospect's words. */
  problem: string;
  /** What they want to improve. */
  improve: string;
  submittedAt: string;
  /** Intake preferences (optional — added Jul 2026). */
  preferredContact?: string;
  bestTime?: string;
  timeline?: string;
  /** Attribution (hidden tracking fields). */
  pageUrl?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  /** Basic lead score, 0–100. */
  score?: number;
  /** Where the lead was captured: website_contact_form | website_chat. */
  source?: string;
};

/** Marketing email list entry (captured by the email popup). */
export type Subscriber = {
  email: string;
  /** Where the signup came from, e.g. "popup". */
  source: string;
  subscribedAt: string;
};

/** One consented page view (first-party analytics via the rsg_vid cookie). */
export type PageView = {
  /** Anonymous visitor id from the rsg_vid cookie. */
  vid: string;
  path: string;
  referrer: string;
  at: string;
};
