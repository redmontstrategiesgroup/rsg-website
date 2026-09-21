import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { DEMO_REQUEST_SLUGS } from "@/lib/demo-request-schema";
import { apiPlatformEnabled } from "@/lib/env";

/** Public, indexable marketing pages. Admin, portal, and API are excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/services", priority: 0.8 },
    { path: "/security", priority: 0.8 },
    { path: "/process", priority: 0.7 },
    { path: "/industries", priority: 0.7 },
    { path: "/book", priority: 0.95 },
    { path: "/book/consultation", priority: 0.85 },
    { path: "/book/strategy", priority: 0.85 },
    { path: "/connect", priority: 0.85 },
    { path: "/start", priority: 0.85 },
    { path: "/faq", priority: 0.6 },
    // Interactive demo systems
    { path: "/demos", priority: 0.8 },
    ...DEMO_REQUEST_SLUGS.map((slug) => ({ path: `/demos/${slug}`, priority: 0.7 })),
    // Local service pages
    { path: "/businessconsulting", priority: 0.8 },
    { path: "/systemsaudit", priority: 0.8 },
    { path: "/aistrategy", priority: 0.8 },
    { path: "/aiautomation", priority: 0.8 },
    { path: "/services/customprivateaisystems", priority: 0.85 },
    { path: "/operationsconsulting", priority: 0.8 },
    {
      path: "/webdevelopment",
      priority: 0.8,
    },
    { path: "/crmsystems", priority: 0.8 },
    // Industry verticals
    { path: "/industries/homeservices", priority: 0.85 },
    { path: "/industries/healthwellness", priority: 0.85 },
    { path: "/industries/realestate", priority: 0.85 },
    // Service area
    { path: "/servicearea", priority: 0.6 },
    // Legal
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
    // API reference — only exists while the platform flag is on (it 404s otherwise)
    ...(apiPlatformEnabled() ? [{ path: "/developers", priority: 0.5 }] : []),
  ];

  return routes.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly",
    priority,
  }));
}
