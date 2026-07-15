import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Public, indexable marketing pages. Admin, portal, and API are excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/services", priority: 0.8 },
    { path: "/process", priority: 0.7 },
    { path: "/industries", priority: 0.7 },
    { path: "/book", priority: 0.95 },
    { path: "/book/consultation", priority: 0.85 },
    { path: "/book/strategy", priority: 0.85 },
    { path: "/connect", priority: 0.85 },
    { path: "/faq", priority: 0.6 },
    // Interactive demo systems
    { path: "/demos", priority: 0.8 },
    { path: "/demos/med-spa", priority: 0.7 },
    { path: "/demos/contractors", priority: 0.7 },
    { path: "/demos/gyms", priority: 0.7 },
    { path: "/demos/dental", priority: 0.7 },
    // Local service pages
    { path: "/business-consulting-plymouth-county-ma", priority: 0.8 },
    { path: "/business-systems-audit-plymouth-county-ma", priority: 0.8 },
    { path: "/ai-strategy-implementation-plymouth-county-ma", priority: 0.8 },
    { path: "/ai-automation-plymouth-county-ma", priority: 0.8 },
    { path: "/operations-consulting-plymouth-county-ma", priority: 0.8 },
    {
      path: "/web-development-digital-infrastructure-plymouth-county-ma",
      priority: 0.8,
    },
    { path: "/crm-pipeline-systems-plymouth-county-ma", priority: 0.8 },
    // Industry pages
    { path: "/med-spa-business-consulting-ai-automation", priority: 0.7 },
    { path: "/gym-fitness-studio-business-systems", priority: 0.7 },
    { path: "/home-service-business-consulting-ai-automation", priority: 0.7 },
    { path: "/dental-wellness-office-ai-strategy", priority: 0.7 },
    { path: "/contractor-business-systems", priority: 0.7 },
    // Service area
    { path: "/service-area-plymouth-county-south-shore-ma", priority: 0.6 },
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
