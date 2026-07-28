/**
 * Connect page storage (server-only). File-store fallback when Supabase
 * is unavailable; durable when configured.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { getSupabase } from "./supabase";
import {
  defaultConnectLinks,
  defaultConnectSettings,
} from "./connect-defaults";
import type {
  ConnectAnalytics,
  ConnectEvent,
  ConnectEventType,
  ConnectLink,
  ConnectSettings,
} from "./connect-types";

export type {
  ConnectAnalytics,
  ConnectEvent,
  ConnectEventType,
  ConnectLink,
  ConnectSettings,
} from "./connect-types";

export {
  defaultConnectLinks,
  defaultConnectSettings,
  filterAndOrderLinks,
  isLinkLive,
} from "./connect-defaults";

const DATA_DIR =
  process.env.DATA_DIR ??
  (process.env.NODE_ENV === "production"
    ? path.join(os.tmpdir(), "rsg-data")
    : path.join(process.cwd(), "data"));

const SETTINGS_FILE = path.join(DATA_DIR, "connect-settings.json");
const LINKS_FILE = path.join(DATA_DIR, "connect-links.json");
const EVENTS_FILE = path.join(DATA_DIR, "connect-events.json");

async function ensureDir() {
  if (process.env.NODE_ENV === "production") return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    /* read-only */
  }
}

async function writeJson(file: string, data: unknown): Promise<boolean> {
  if (process.env.NODE_ENV === "production") {
    console.error(
      `[connect] refusing file write in production (${path.basename(file)}). Configure Supabase.`
    );
    return false;
  }
  try {
    await ensureDir();
    await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getConnectSettings(): Promise<ConnectSettings> {
  const defaults = defaultConnectSettings();
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("connect_settings")
        .select("*")
        .eq("id", "default")
        .limit(1);
      if (error) throw error;
      const row = data?.[0] as Record<string, unknown> | undefined;
      if (row) return mergeConnectSettings(rowToSettings(row), defaults);
    } catch (err) {
      console.warn("[connect] settings read failed — using file/defaults.", err);
    }
  }
  const file = await readJson<ConnectSettings | null>(SETTINGS_FILE, null);
  return mergeConnectSettings(file ?? defaults, defaults);
}

const LEGACY_LINKEDIN =
  "https://www.linkedin.com/company/redmont-strategies-group";
const AI_BADGE_LABELS = new Set(["Official RSG Page", "Featured", "New", "Popular"]);

function mergeConnectSettings(
  settings: ConnectSettings,
  defaults: ConnectSettings
): ConnectSettings {
  const linkedin = settings.socialLinkedin || defaults.socialLinkedin;
  const badgeLabel = AI_BADGE_LABELS.has(settings.badgeLabel.trim())
    ? ""
    : settings.badgeLabel;
  const campaignBadge = AI_BADGE_LABELS.has(settings.campaignBadge.trim())
    ? ""
    : settings.campaignBadge;

  return {
    ...settings,
    badgeLabel,
    campaignBadge,
    socialLinkedin:
      !linkedin || linkedin === LEGACY_LINKEDIN
        ? defaults.socialLinkedin
        : linkedin,
    socialInstagram: settings.socialInstagram || defaults.socialInstagram,
    // Facebook is no longer shown on the connect page.
    socialFacebook: "",
    socialEmail: settings.socialEmail || defaults.socialEmail,
  };
}

export async function saveConnectSettings(
  settings: ConnectSettings,
  updatedBy?: string
): Promise<ConnectSettings> {
  const next: ConnectSettings = {
    ...settings,
    socialFacebook: "",
    updatedAt: new Date().toISOString(),
  };
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from("connect_settings").upsert({
        id: "default",
        headline: next.headline,
        description: next.description,
        badge_label: next.badgeLabel,
        campaign_title: next.campaignTitle,
        campaign_description: next.campaignDescription,
        campaign_url: next.campaignUrl,
        campaign_badge: next.campaignBadge,
        campaign_active: next.campaignActive,
        social_linkedin: next.socialLinkedin,
        social_instagram: next.socialInstagram,
        social_facebook: next.socialFacebook,
        social_email: next.socialEmail,
        published: next.published,
        updated_at: next.updatedAt,
        updated_by: updatedBy ?? null,
      });
      if (error) throw error;
    } catch (err) {
      console.warn("[connect] settings write to Supabase failed.", err);
    }
  }
  await writeJson(SETTINGS_FILE, next);
  return next;
}

export async function getConnectLinks(): Promise<ConnectLink[]> {
  const retired = new Set([
    "link-audit",
    "link-ai",
    "link-consulting",
    "link-web",
    "link-crm",
    "link-contact",
  ]);
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("connect_links")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      if (data && data.length) {
        const links = (data as Record<string, unknown>[])
          .map(rowToLink)
          .filter((l) => !retired.has(l.id));
        if (links.length) return links;
      }
    } catch (err) {
      console.warn("[connect] links read failed — using file/defaults.", err);
    }
  }
  const file = await readJson<ConnectLink[] | null>(LINKS_FILE, null);
  if (file && file.length) {
    return file
      .filter((l) => !retired.has(l.id))
      .map((l) => ({
        ...l,
        badge: AI_BADGE_LABELS.has(String(l.badge)) ? "" : l.badge,
      }));
  }
  const defaults = defaultConnectLinks();
  await writeJson(LINKS_FILE, defaults);
  return defaults;
}

export async function saveConnectLinks(links: ConnectLink[]): Promise<ConnectLink[]> {
  const normalized = links
    .map((l, i) => ({
      ...l,
      id: l.id || randomUUID(),
      displayOrder: typeof l.displayOrder === "number" ? l.displayOrder : i,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: existing } = await supabase.from("connect_links").select("id");
      const keep = new Set(normalized.map((l) => l.id));
      const toDelete = ((existing as { id: string }[]) ?? [])
        .map((r) => r.id)
        .filter((id) => !keep.has(id));
      if (toDelete.length) {
        await supabase.from("connect_links").delete().in("id", toDelete);
      }
      for (const link of normalized) {
        const { error } = await supabase.from("connect_links").upsert({
          id: link.id,
          title: link.title,
          description: link.description,
          url: link.url,
          icon: link.icon,
          badge: link.badge || null,
          display_order: link.displayOrder,
          featured: link.featured,
          active: link.active,
          open_new_tab: link.openNewTab,
          starts_at: link.startsAt || null,
          expires_at: link.expiresAt || null,
          sources: link.sources ?? [],
          utm_params: link.utmParams ?? {},
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
    } catch (err) {
      console.warn("[connect] links write to Supabase failed.", err);
    }
  }
  await writeJson(LINKS_FILE, normalized);
  return normalized;
}

export async function recordConnectEvent(
  event: Omit<ConnectEvent, "id" | "createdAt"> & { id?: string; createdAt?: string }
): Promise<void> {
  const full: ConnectEvent = {
    id: event.id ?? randomUUID(),
    createdAt: event.createdAt ?? new Date().toISOString(),
    eventType: event.eventType,
    linkId: event.linkId,
    sessionId: event.sessionId,
    visitorId: event.visitorId,
    source: event.source,
    medium: event.medium,
    campaign: event.campaign,
    referrer: event.referrer,
    device: event.device,
    path: event.path,
    meta: event.meta,
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from("connect_events").insert({
        id: full.id,
        event_type: full.eventType,
        link_id: full.linkId ?? null,
        session_id: full.sessionId ?? null,
        visitor_id: full.visitorId ?? null,
        source: full.source ?? null,
        medium: full.medium ?? null,
        campaign: full.campaign ?? null,
        referrer: full.referrer ?? null,
        device: full.device ?? null,
        path: full.path ?? null,
        meta: full.meta ?? {},
        created_at: full.createdAt,
      });
    } catch (err) {
      console.warn("[connect] event write to Supabase failed.", err);
    }
  }

  const events = await readJson<ConnectEvent[]>(EVENTS_FILE, []);
  events.unshift(full);
  await writeJson(EVENTS_FILE, events.slice(0, 10_000));
}

export async function getConnectEvents(limit = 5000): Promise<ConnectEvent[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("connect_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      if (data) {
        return (data as Record<string, unknown>[]).map((row) => ({
          id: String(row.id),
          eventType: row.event_type as ConnectEventType,
          linkId: (row.link_id as string) ?? undefined,
          sessionId: (row.session_id as string) ?? undefined,
          visitorId: (row.visitor_id as string) ?? undefined,
          source: (row.source as string) ?? undefined,
          medium: (row.medium as string) ?? undefined,
          campaign: (row.campaign as string) ?? undefined,
          referrer: (row.referrer as string) ?? undefined,
          device: (row.device as string) ?? undefined,
          path: (row.path as string) ?? undefined,
          meta: (row.meta as Record<string, unknown>) ?? undefined,
          createdAt: String(row.created_at),
        }));
      }
    } catch (err) {
      console.warn("[connect] events read failed.", err);
    }
  }
  return readJson<ConnectEvent[]>(EVENTS_FILE, []);
}

export async function summarizeConnectAnalytics(
  links: ConnectLink[],
  events: ConnectEvent[]
): Promise<ConnectAnalytics> {
  const views = events.filter((e) => e.eventType === "page_view");
  const clicks = events.filter(
    (e) =>
      e.eventType === "link_click" ||
      e.eventType === "cta_click" ||
      e.eventType === "campaign_click"
  );
  const unique = new Set(
    views.map((e) => e.visitorId || e.sessionId).filter(Boolean) as string[]
  );
  const formStarts = events.filter((e) => e.eventType === "form_start").length;
  const formCompletions = events.filter((e) => e.eventType === "form_complete").length;
  const qrScans = events.filter((e) => e.eventType === "qr_scan").length;
  const ctaClicks = events.filter((e) => e.eventType === "cta_click").length;

  const byLinkMap = new Map<string, number>();
  for (const c of clicks) {
    if (!c.linkId) continue;
    byLinkMap.set(c.linkId, (byLinkMap.get(c.linkId) ?? 0) + 1);
  }
  const titleById = new Map(links.map((l) => [l.id, l.title]));
  const byLink = [...byLinkMap.entries()]
    .map(([id, count]) => ({
      id,
      title:
        titleById.get(id) ??
        (id === "cta" ? "Book a Strategy Call" : id === "campaign" ? "Campaign" : id),
      clicks: count,
    }))
    .sort((a, b) => b.clicks - a.clicks);

  const bySourceMap = new Map<string, { views: number; clicks: number }>();
  for (const e of events) {
    const src = (e.source || "direct").toLowerCase();
    const cur = bySourceMap.get(src) ?? { views: 0, clicks: 0 };
    if (e.eventType === "page_view" || e.eventType === "qr_scan") cur.views += 1;
    if (
      e.eventType === "link_click" ||
      e.eventType === "cta_click" ||
      e.eventType === "campaign_click"
    ) {
      cur.clicks += 1;
    }
    bySourceMap.set(src, cur);
  }
  const bySource = [...bySourceMap.entries()]
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.views - a.views);

  const trendMap = new Map<string, { views: number; clicks: number }>();
  for (const e of events) {
    const date = e.createdAt.slice(0, 10);
    const cur = trendMap.get(date) ?? { views: 0, clicks: 0 };
    if (e.eventType === "page_view" || e.eventType === "qr_scan") cur.views += 1;
    if (
      e.eventType === "link_click" ||
      e.eventType === "cta_click" ||
      e.eventType === "campaign_click"
    ) {
      cur.clicks += 1;
    }
    trendMap.set(date, cur);
  }
  const trend = [...trendMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  const totalViews = views.length + qrScans;
  return {
    totalViews,
    uniqueVisitors: unique.size,
    linkClicks: clicks.length,
    ctaClicks,
    formStarts,
    formCompletions,
    qrScans,
    conversionRate: totalViews ? formCompletions / totalViews : 0,
    clickThroughRate: totalViews ? clicks.length / totalViews : 0,
    byLink,
    bySource,
    trend,
  };
}

function rowToSettings(row: Record<string, unknown>): ConnectSettings {
  return {
    headline: String(row.headline ?? ""),
    description: String(row.description ?? ""),
    badgeLabel: String(row.badge_label ?? ""),
    campaignTitle: String(row.campaign_title ?? ""),
    campaignDescription: String(row.campaign_description ?? ""),
    campaignUrl: String(row.campaign_url ?? ""),
    campaignBadge: String(row.campaign_badge ?? ""),
    campaignActive: Boolean(row.campaign_active),
    socialLinkedin: String(row.social_linkedin ?? ""),
    socialInstagram: String(row.social_instagram ?? ""),
    socialFacebook: String(row.social_facebook ?? ""),
    socialEmail: String(row.social_email ?? "contact@redmontstrategiesgroup.com"),
    published: row.published !== false,
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function rowToLink(row: Record<string, unknown>): ConnectLink {
  const rawBadge = String(row.badge ?? "");
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ""),
    url: String(row.url),
    icon: String(row.icon ?? "link"),
    badge: AI_BADGE_LABELS.has(rawBadge) ? "" : rawBadge,
    displayOrder: Number(row.display_order ?? 0),
    featured: Boolean(row.featured),
    active: row.active !== false,
    openNewTab: Boolean(row.open_new_tab),
    startsAt: (row.starts_at as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
    sources: Array.isArray(row.sources) ? (row.sources as string[]) : [],
    utmParams: (row.utm_params as Record<string, string>) ?? {},
  };
}
