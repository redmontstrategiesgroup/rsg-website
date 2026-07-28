import { PHONE_TEL, SITE_URL } from "@/lib/site";
import type { IndustryVertical } from "@/lib/industries/types";

/**
 * Structured data for a vertical page: Service, BreadcrumbList, and FAQPage.
 * Built from the same vertical object as the visible page, so the markup can
 * never drift from what a visitor sees.
 */
export function VerticalJsonLd({ vertical }: { vertical: IndustryVertical }) {
  const pageUrl = `${SITE_URL}/industries/${vertical.slug}`;

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${vertical.name} — Systems, Automation & AI`,
    description: vertical.seo.description,
    serviceType: "Business systems, automation, and AI implementation",
    url: pageUrl,
    audience: {
      "@type": "BusinessAudience",
      name: vertical.name,
    },
    provider: {
      "@type": "Organization",
      name: "Redmont Strategies Group",
      url: SITE_URL,
      telephone: PHONE_TEL,
    },
    areaServed: [
      { "@type": "AdministrativeArea", name: "Plymouth County, Massachusetts" },
      { "@type": "AdministrativeArea", name: "South Shore, Massachusetts" },
    ],
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Industries", item: `${SITE_URL}/industries` },
      { "@type": "ListItem", position: 3, name: vertical.shortName, item: pageUrl },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: vertical.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
    </>
  );
}
