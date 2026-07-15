/** Shared Connect page types (client + server safe). */

export type ConnectBadge = "" | "Featured" | "New" | "Popular" | "Campaign";

export type ConnectLink = {
  id: string;
  title: string;
  description: string;
  url: string;
  icon: string;
  badge: ConnectBadge | string;
  displayOrder: number;
  featured: boolean;
  active: boolean;
  openNewTab: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
  sources: string[];
  utmParams?: Record<string, string>;
};

export type ConnectSettings = {
  headline: string;
  description: string;
  badgeLabel: string;
  campaignTitle: string;
  campaignDescription: string;
  campaignUrl: string;
  campaignBadge: string;
  campaignActive: boolean;
  socialLinkedin: string;
  socialInstagram: string;
  socialFacebook: string;
  socialEmail: string;
  published: boolean;
  updatedAt: string;
};

export type ConnectEventType =
  | "page_view"
  | "link_click"
  | "cta_click"
  | "campaign_click"
  | "form_start"
  | "form_complete"
  | "qr_scan";

export type ConnectEvent = {
  id: string;
  eventType: ConnectEventType;
  linkId?: string;
  sessionId?: string;
  visitorId?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  device?: string;
  path?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
};

export type ConnectAnalytics = {
  totalViews: number;
  uniqueVisitors: number;
  linkClicks: number;
  ctaClicks: number;
  formStarts: number;
  formCompletions: number;
  qrScans: number;
  conversionRate: number;
  clickThroughRate: number;
  byLink: { id: string; title: string; clicks: number }[];
  bySource: { source: string; views: number; clicks: number }[];
  trend: { date: string; views: number; clicks: number }[];
};
