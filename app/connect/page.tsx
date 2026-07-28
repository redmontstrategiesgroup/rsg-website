import type { Metadata } from "next";
import Link from "next/link";
import {
  filterAndOrderLinks,
  getConnectLinks,
  getConnectSettings,
} from "@/lib/connect";
import { ConnectPageView } from "@/components/connect/ConnectPage";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connect | Redmont Strategies Group",
  description:
    "Book a strategy call, explore RSG services, view industry demos, and contact Redmont Strategies Group.",
  alternates: { canonical: `${SITE_URL}/connect` },
  openGraph: {
    title: "Connect with Redmont Strategies Group",
    description:
      "Business consulting, AI implementation, automation, and digital infrastructure. Book a strategy call or explore our systems.",
    url: `${SITE_URL}/connect`,
    siteName: "Redmont Strategies Group",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Connect with Redmont Strategies Group",
    description:
      "Book a strategy call, explore services, and view industry demo systems.",
  },
  robots: { index: true, follow: true },
};

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pick = (key: string) => {
    const v = params[key];
    return typeof v === "string" ? v.slice(0, 120) : "";
  };

  const source = pick("source") || pick("utm_source");
  const campaign = pick("campaign") || pick("utm_campaign");

  const [settings, allLinks] = await Promise.all([
    getConnectSettings(),
    getConnectLinks(),
  ]);

  if (!settings.published) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base px-6 text-center text-white">
        <div>
          <h1 className="display text-2xl">Connect page unavailable</h1>
          <p className="mt-3 text-white/50">
            This page is currently unpublished. Visit{" "}
            <Link href="/" className="text-crimson-light hover:underline">
              redmontstrategiesgroup.com
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const links = filterAndOrderLinks(allLinks, source);

  return (
    <ConnectPageView
      settings={settings}
      links={links}
      source={source}
      campaign={campaign}
      utm={{
        utm_source: pick("utm_source"),
        utm_medium: pick("utm_medium"),
        utm_campaign: pick("utm_campaign"),
        utm_content: pick("utm_content"),
        utm_term: pick("utm_term"),
      }}
    />
  );
}
