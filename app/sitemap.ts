import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

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
    { path: "/faq", priority: 0.6 },
    // Interactive demo systems
    { path: "/demos", priority: 0.8 },
    { path: "/demos/medspa", priority: 0.7 },
    { path: "/demos/contractors", priority: 0.7 },
    { path: "/demos/gyms", priority: 0.7 },
    { path: "/demos/dental", priority: 0.7 },
    { path: "/demos/retail", priority: 0.7 },
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
    { path: "/industries/dentalpractices", priority: 0.85 },
    { path: "/industries/retail", priority: 0.85 },
    // Service area
    { path: "/servicearea", priority: 0.6 },
    // Legal
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly",
    priority,
  }));
}
