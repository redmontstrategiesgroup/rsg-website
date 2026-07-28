"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  Calendar,
  Filter,
  Globe,
  Lock,
  Mail,
  Monitor,
  Search,
  ShieldCheck,
  Sparkles,
  Link as LinkIcon,
} from "lucide-react";
import type { ConnectLink, ConnectSettings } from "@/lib/connect-types";
import { postJson } from "@/lib/api";
import { SITE_URL } from "@/lib/site";

const ICONS: Record<string, typeof Calendar> = {
  calendar: Calendar,
  briefcase: Briefcase,
  search: Search,
  monitor: Monitor,
  sparkles: Sparkles,
  building: Building2,
  globe: Globe,
  funnel: Filter,
  filter: Filter,
  lock: Lock,
  mail: Mail,
  link: LinkIcon,
};

function deviceCategory() {
  if (typeof window === "undefined") return "unknown";
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function getOrCreateId(key: string) {
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function appendUtm(href: string, params: Record<string, string | undefined>) {
  try {
    const absolute = href.startsWith("http")
      ? href
      : `${SITE_URL}${href.startsWith("/") ? href : `/${href}`}`;
    const u = new URL(absolute);
    for (const [k, v] of Object.entries(params)) {
      if (v) u.searchParams.set(k, v);
    }
    // Keep relative links relative for same-origin navigation.
    if (href.startsWith("/")) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
    return u.toString();
  } catch {
    return href;
  }
}

export function ConnectPageView({
  settings,
  links,
  source,
  campaign,
  utm,
}: {
  settings: ConnectSettings;
  links: ConnectLink[];
  source: string;
  campaign: string;
  utm: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  };
}) {
  const [sessionId] = useState(() =>
    typeof window === "undefined" ? "" : getOrCreateId("rsg_connect_sid")
  );
  const [visitorId] = useState(() =>
    typeof window === "undefined" ? "" : getOrCreateId("rsg_vid")
  );
  const trackedView = useRef(false);

  const attribution = useMemo(
    () => ({
      source: source || utm.utm_source || "direct",
      campaign: campaign || utm.utm_campaign || "",
      medium: utm.utm_medium || (source ? "social" : "connect"),
    }),
    [source, campaign, utm]
  );

  function track(
    eventType:
      | "page_view"
      | "link_click"
      | "cta_click"
      | "campaign_click"
      | "form_start"
      | "form_complete",
    linkId?: string
  ) {
    void postJson("/api/connect/event", {
      eventType,
      linkId,
      sessionId,
      visitorId,
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign || undefined,
      referrer: typeof document !== "undefined" ? document.referrer.slice(0, 400) : "",
      device: deviceCategory(),
      path: "/connect",
    });
  }

  useEffect(() => {
    if (trackedView.current) return;
    trackedView.current = true;
    track("page_view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bookingHref = appendUtm("/book", {
    utm_source: attribution.source,
    utm_medium: "connect_page",
    utm_campaign: attribution.campaign || "rsg_connect",
    utm_content: "primary_cta",
  });

  const campaignHref = settings.campaignUrl
    ? appendUtm(settings.campaignUrl, {
        utm_source: attribution.source,
        utm_medium: "connect_page",
        utm_campaign: attribution.campaign || "rsg_connect",
        utm_content: "campaign_card",
      })
    : "";

  return (
    <div className="relative min-h-dvh bg-base text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-[0.22]" />
        <div className="absolute left-1/2 top-[-8%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-crimson/[0.07] blur-[140px]" />
      </div>

      <main className="mx-auto w-full max-w-lg px-5 pb-16 pt-10 sm:pt-14">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/rsg-mark.png"
            alt="Redmont Strategies Group"
            className="mx-auto h-20 w-auto sm:h-24"
            width={96}
            height={96}
          />
          {settings.badgeLabel ? (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[0.54rem] uppercase tracking-label text-crimson-light">
              <ShieldCheck size={12} aria-hidden />
              {settings.badgeLabel}
            </p>
          ) : null}
          <h1 className="display mt-4 text-[1.65rem] font-semibold leading-tight tracking-tight sm:text-[1.9rem]">
            {settings.headline}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/55">
            {settings.description}
          </p>

          <SocialRow settings={settings} />
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8"
        >
          <Link
            href={bookingHref}
            onClick={() => track("cta_click", "cta")}
            className="btn-primary group flex w-full items-center justify-center gap-2 py-3.5 text-[0.95rem]"
          >
            Book a Strategy Call
            <ArrowUpRight
              size={17}
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </Link>
        </motion.div>

        {settings.campaignActive && settings.campaignTitle && campaignHref ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4"
          >
            <Link
              href={campaignHref}
              onClick={() => track("campaign_click", "campaign")}
              className="block rounded-xl border border-crimson/35 bg-crimson/[0.08] p-4 transition-colors hover:border-crimson/55 hover:bg-crimson/[0.12]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  {settings.campaignBadge ? (
                    <span className="font-mono text-[0.52rem] uppercase tracking-label text-crimson-light">
                      {settings.campaignBadge}
                    </span>
                  ) : null}
                  <p className="mt-1 text-[0.98rem] font-medium text-white">
                    {settings.campaignTitle}
                  </p>
                  {settings.campaignDescription ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                      {settings.campaignDescription}
                    </p>
                  ) : null}
                </div>
                <ArrowUpRight size={16} className="mt-1 shrink-0 text-crimson-light" />
              </div>
            </Link>
          </motion.div>
        ) : null}

        <ul className="mt-5 space-y-3">
          {links.map((link, index) => {
            const Icon = ICONS[link.icon] ?? LinkIcon;
            const href = appendUtm(link.url, {
              ...(link.utmParams ?? {}),
              utm_source: attribution.source,
              utm_medium: "connect_page",
              utm_campaign: attribution.campaign || "rsg_connect",
              utm_content: link.id,
            });
            const external =
              link.openNewTab ||
              (href.startsWith("http") && !href.startsWith(SITE_URL));

            return (
              <motion.li
                key={link.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: 0.14 + index * 0.03,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <a
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  onClick={() => track("link_click", link.id)}
                  className={`group flex items-start gap-3.5 rounded-xl border p-4 transition-colors ${
                    link.featured
                      ? "border-white/18 bg-white/[0.045] hover:border-white/28"
                      : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-crimson-light">
                    <Icon size={17} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.95rem] font-medium text-white">
                        {link.title}
                      </span>
                      {link.badge ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-label text-white/50">
                          {link.badge}
                        </span>
                      ) : null}
                    </span>
                    {link.description ? (
                      <span className="mt-1 block text-sm leading-relaxed text-white/45">
                        {link.description}
                      </span>
                    ) : null}
                  </span>
                  <ArrowUpRight
                    size={15}
                    className="mt-1 shrink-0 text-white/30 transition-colors group-hover:text-white/70"
                  />
                </a>
              </motion.li>
            );
          })}
        </ul>

        <footer className="mt-10 border-t border-white/10 pt-6 text-center">
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-white/40">
            <Link href="/" className="hover:text-white">
              Main Website
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
          </nav>
          <p className="mt-4 text-xs text-white/30">
            © {new Date().getFullYear()} Redmont Strategies Group
          </p>
        </footer>
      </main>
    </div>
  );
}

function SocialRow({ settings }: { settings: ConnectSettings }) {
  const items = [
    settings.socialLinkedin
      ? { label: "LinkedIn", href: settings.socialLinkedin }
      : null,
    settings.socialInstagram
      ? { label: "Instagram", href: settings.socialInstagram }
      : null,
    {
      label: "Email",
      href: `mailto:${settings.socialEmail || "contact@redmontstrategiesgroup.com"}`,
    },
  ].filter(Boolean) as { label: string; href: string }[];

  if (!items.length) return null;

  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          target={item.href.startsWith("http") ? "_blank" : undefined}
          rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/55 transition-colors hover:border-white/25 hover:text-white"
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}
