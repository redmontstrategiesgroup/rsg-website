import type { PageView } from "./types";

/** Aggregated, display-ready analytics (computed server-side for admin). */
export type AnalyticsSummary = {
  windowDays: number;
  totalViews: number;
  uniqueVisitors: number;
  topPages: { path: string; views: number; visitors: number }[];
  /** Chronological, most recent last. */
  days: { date: string; views: number; visitors: number }[];
};

const WINDOW_DAYS = 30;
const DAY_ROWS = 14;
const TOP_PAGES = 8;

export function summarizeAnalytics(events: PageView[]): AnalyticsSummary {
  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = events.filter((e) => {
    const t = Date.parse(e.at);
    return Number.isFinite(t) && t >= cutoff;
  });

  const visitors = new Set<string>();
  const byPage = new Map<string, { views: number; vids: Set<string> }>();
  const byDay = new Map<string, { views: number; vids: Set<string> }>();

  for (const e of recent) {
    visitors.add(e.vid);

    const page = byPage.get(e.path) ?? { views: 0, vids: new Set() };
    page.views += 1;
    page.vids.add(e.vid);
    byPage.set(e.path, page);

    const day = e.at.slice(0, 10);
    const d = byDay.get(day) ?? { views: 0, vids: new Set() };
    d.views += 1;
    d.vids.add(e.vid);
    byDay.set(day, d);
  }

  const topPages = [...byPage.entries()]
    .map(([path, v]) => ({ path, views: v.views, visitors: v.vids.size }))
    .sort((a, b) => b.views - a.views)
    .slice(0, TOP_PAGES);

  const days = [...byDay.entries()]
    .map(([date, v]) => ({ date, views: v.views, visitors: v.vids.size }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-DAY_ROWS);

  return {
    windowDays: WINDOW_DAYS,
    totalViews: recent.length,
    uniqueVisitors: visitors.size,
    topPages,
    days,
  };
}
