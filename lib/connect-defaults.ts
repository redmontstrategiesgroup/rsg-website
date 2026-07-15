/**
 * Connect page defaults — safe for client and server imports (no Node I/O).
 */

import type { ConnectLink, ConnectSettings } from "./connect-types";

export type {
  ConnectBadge,
  ConnectLink,
  ConnectSettings,
  ConnectEventType,
  ConnectEvent,
  ConnectAnalytics,
} from "./connect-types";

export function defaultConnectSettings(): ConnectSettings {
  return {
    headline: "Redmont Strategies Group",
    description:
      "Business Consulting, AI Implementation, Automation, and Digital Infrastructure.",
    badgeLabel: "Official RSG Page",
    campaignTitle: "Find the Revenue Leaks in Your Business",
    campaignDescription:
      "A focused systems assessment of lead follow-up, missed calls, and booking gaps.",
    campaignUrl: "/book",
    campaignBadge: "Featured",
    campaignActive: true,
    socialLinkedin: "https://www.linkedin.com/company/redmont-strategies-group",
    socialInstagram: "https://www.instagram.com/redmontstrategiesgroup/",
    socialFacebook: "https://www.facebook.com/redmontstrategiesgroup",
    socialEmail: "contact@redmontstrategiesgroup.com",
    published: true,
    updatedAt: new Date().toISOString(),
  };
}

export function defaultConnectLinks(): ConnectLink[] {
  return [
    {
      id: "link-book",
      title: "Book a Strategy Call",
      description: "Schedule a focused conversation about your operations and growth systems.",
      url: "/book",
      icon: "calendar",
      badge: "Featured",
      displayOrder: 0,
      featured: true,
      active: true,
      openNewTab: false,
      sources: [],
    },
    {
      id: "link-services",
      title: "Explore Our Services",
      description: "Strategy, automation, operations, CRM, and digital infrastructure.",
      url: "/services",
      icon: "briefcase",
      badge: "",
      displayOrder: 1,
      featured: false,
      active: true,
      openNewTab: false,
      sources: [],
    },
    {
      id: "link-demos",
      title: "View Industry Demo Systems",
      description: "Interactive operating systems for med spas, gyms, dental, and contractors.",
      url: "/demos",
      icon: "monitor",
      badge: "New",
      displayOrder: 2,
      featured: false,
      active: true,
      openNewTab: false,
      sources: ["instagram", "tiktok"],
    },
    {
      id: "link-portal",
      title: "Client Portal",
      description: "Secure access for active Redmont Strategies Group clients.",
      url: "/login",
      icon: "lock",
      badge: "",
      displayOrder: 3,
      featured: false,
      active: true,
      openNewTab: false,
      sources: [],
    },
  ];
}

const SOURCE_PRIORITY: Record<string, string[]> = {
  instagram: ["link-demos", "link-book", "link-services"],
  tiktok: ["link-demos", "link-book", "link-services"],
  linkedin: ["link-book", "link-services", "link-demos"],
  "business-card": ["link-book", "link-services", "link-portal"],
  qr: ["link-book", "link-services", "link-demos"],
};

export function isLinkLive(link: ConnectLink, now = Date.now()): boolean {
  if (!link.active) return false;
  if (link.startsAt && new Date(link.startsAt).getTime() > now) return false;
  if (link.expiresAt && new Date(link.expiresAt).getTime() < now) return false;
  return true;
}

export function filterAndOrderLinks(
  links: ConnectLink[],
  source?: string | null
): ConnectLink[] {
  const now = Date.now();
  const src = (source ?? "").trim().toLowerCase();
  let live = links.filter((l) => isLinkLive(l, now));

  if (src) {
    live = live.filter(
      (l) => !l.sources.length || l.sources.map((s) => s.toLowerCase()).includes(src)
    );
  }

  const priority = SOURCE_PRIORITY[src] ?? [];
  return [...live].sort((a, b) => {
    const ai = priority.indexOf(a.id);
    const bi = priority.indexOf(b.id);
    const aRank = ai === -1 ? 1000 + a.displayOrder : ai;
    const bRank = bi === -1 ? 1000 + b.displayOrder : bi;
    if (aRank !== bRank) return aRank - bRank;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.displayOrder - b.displayOrder;
  });
}
