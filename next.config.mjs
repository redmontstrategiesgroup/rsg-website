import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the workspace root to this project (a stray lockfile lives in the
  // parent directory, which would otherwise confuse Next's root inference).
  outputFileTracingRoot: __dirname,
  async redirects() {
    return [
      {
        source: "/contact",
        destination: "/book",
        permanent: true,
      },
      // Old thin industry pages → the three specialized verticals (Jul 2026).
      {
        source: "/home-service-business-consulting-ai-automation",
        destination: "/industries/homeservices",
        permanent: true,
      },
      {
        source: "/contractor-business-systems",
        destination: "/industries/homeservices",
        permanent: true,
      },
      {
        source: "/dental-wellness-office-ai-strategy",
        destination: "/industries/dentalpractices",
        permanent: true,
      },
      {
        source: "/med-spa-business-consulting-ai-automation",
        destination: "/industries/dentalpractices",
        permanent: true,
      },
      {
        source: "/retail-business-systems",
        destination: "/industries/retail",
        permanent: true,
      },
      {
        source: "/gym-fitness-studio-business-systems",
        destination: "/industries",
        permanent: true,
      },
      // Retired pages (Jul 2026): the additional-industries page and the
      // packaged managed-services plans. Every engagement is scoped and
      // priced individually, so both were removed rather than rewritten.
      { source: "/industries/additional", destination: "/industries", permanent: true },
      { source: "/managedservices", destination: "/services", permanent: true },
      // De-hyphenated URL migration (Jul 2026). Old hyphenated slugs → new
      // slugs; local SEO service pages also drop the "-plymouth-county-ma" tail.
      { source: "/ai-strategy-implementation-plymouth-county-ma", destination: "/aistrategy", permanent: true },
      { source: "/ai-automation-plymouth-county-ma", destination: "/aiautomation", permanent: true },
      { source: "/business-consulting-plymouth-county-ma", destination: "/businessconsulting", permanent: true },
      { source: "/business-systems-audit-plymouth-county-ma", destination: "/systemsaudit", permanent: true },
      { source: "/crm-pipeline-systems-plymouth-county-ma", destination: "/crmsystems", permanent: true },
      { source: "/operations-consulting-plymouth-county-ma", destination: "/operationsconsulting", permanent: true },
      { source: "/service-area-plymouth-county-south-shore-ma", destination: "/servicearea", permanent: true },
      { source: "/web-development-digital-infrastructure-plymouth-county-ma", destination: "/webdevelopment", permanent: true },
      { source: "/managed-services", destination: "/services", permanent: true },
      { source: "/thank-you", destination: "/thankyou", permanent: true },
      { source: "/services/custom-private-ai-systems", destination: "/services/customprivateaisystems", permanent: true },
      { source: "/industries/home-services", destination: "/industries/homeservices", permanent: true },
      { source: "/industries/dental-practices", destination: "/industries/dentalpractices", permanent: true },
      { source: "/booking/not-eligible", destination: "/booking/noteligible", permanent: true },
      { source: "/demo-preview/:path*", destination: "/demopreview/:path*", permanent: true },
      { source: "/demos/med-spa", destination: "/demos/medspa", permanent: true },
      // De-hyphenated API routes (308 preserves method + body for POST callers).
      { source: "/api/demo-request", destination: "/api/demorequest", permanent: true },
      { source: "/api/private-ai/:path*", destination: "/api/privateai/:path*", permanent: true },
      { source: "/api/admin/private-ai", destination: "/api/admin/privateai", permanent: true },
      { source: "/api/admin/managed-services", destination: "/api/admin/managedservices", permanent: true },
      { source: "/api/portal/managed-services", destination: "/api/portal/managedservices", permanent: true },
    ];
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://js.sentry-cdn.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.resend.com https://*.ingest.sentry.io https://*.sentry.io https://challenges.cloudflare.com",
      "frame-src 'self' https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        // The demo pages embed /demopreview/* in a same-origin iframe for
        // the mobile-preview toggle. Same-origin framing only — cross-site
        // clickjacking remains blocked.
        source: "/demopreview/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp.replace("frame-ancestors 'none'", "frame-ancestors 'self'"),
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        // The Observatory app (public/apps/observatory) is embedded in a
        // same-origin iframe by the authenticated /portal/observatory page.
        source: "/apps/observatory/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp.replace("frame-ancestors 'none'", "frame-ancestors 'self'"),
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

const sentryEnabled = Boolean(
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
);

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
      automaticVercelMonitors: true,
    })
  : nextConfig;
