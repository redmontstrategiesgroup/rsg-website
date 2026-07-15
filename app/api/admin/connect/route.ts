import { NextResponse } from "next/server";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import {
  getConnectEvents,
  getConnectLinks,
  getConnectSettings,
  saveConnectLinks,
  saveConnectSettings,
  summarizeConnectAnalytics,
  type ConnectLink,
  type ConnectSettings,
} from "@/lib/connect";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await requireAdmin("manage_clients");
  if (!isAdminContext(ctx)) return ctx;

  const [settings, links, events] = await Promise.all([
    getConnectSettings(),
    getConnectLinks(),
    getConnectEvents(),
  ]);
  const analytics = await summarizeConnectAnalytics(links, events);

  return NextResponse.json({ settings, links, analytics });
}

export async function PUT(request: Request) {
  const ctx = await requireAdmin("manage_clients");
  if (!isAdminContext(ctx)) return ctx;

  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  let body: {
    settings?: ConnectSettings;
    links?: ConnectLink[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (!body.settings || !Array.isArray(body.links)) {
    return NextResponse.json(
      { error: "settings and links are required." },
      { status: 400 }
    );
  }

  // Basic sanitization of links.
  const links = body.links.slice(0, 40).map((l, i) => ({
    id: String(l.id || "").slice(0, 80),
    title: String(l.title || "").slice(0, 120),
    description: String(l.description || "").slice(0, 300),
    url: String(l.url || "").slice(0, 500),
    icon: String(l.icon || "link").slice(0, 40),
    badge: String(l.badge || "").slice(0, 40),
    displayOrder: Number.isFinite(l.displayOrder) ? Number(l.displayOrder) : i,
    featured: Boolean(l.featured),
    active: l.active !== false,
    openNewTab: Boolean(l.openNewTab),
    startsAt: l.startsAt || null,
    expiresAt: l.expiresAt || null,
    sources: Array.isArray(l.sources)
      ? l.sources.map((s) => String(s).slice(0, 40)).slice(0, 12)
      : [],
    utmParams: l.utmParams ?? {},
  }));

  if (links.some((l) => !l.title || !l.url)) {
    return NextResponse.json(
      { error: "Every link needs a title and URL." },
      { status: 400 }
    );
  }

  const settings = await saveConnectSettings(body.settings, ctx.admin.email);
  const savedLinks = await saveConnectLinks(links);
  return NextResponse.json({ settings, links: savedLinks });
}
