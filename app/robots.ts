import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/dashboard",
        "/portal",
        "/login",
        "/api/",
        "/thank-you",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
