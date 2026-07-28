import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { SecurityPage } from "@/components/security/SecurityPage";
import { SECURITY_FAQS } from "@/lib/security-center/marketing";
import { SITE_URL } from "@/lib/site";

const PATH = "/security";

export const metadata: Metadata = {
  title: "The RSG Secure Systems Standard | Redmont Strategies Group",
  description:
    "How RSG builds secure, production-ready business systems: identity and access, data protection, responsible-AI controls, backups, audit logs, vendor documentation, and incident response — informed by NIST and OWASP guidance.",
  alternates: { canonical: `${SITE_URL}${PATH}` },
  openGraph: {
    title: "The RSG Secure Systems Standard | Redmont Strategies Group",
    description:
      "Security, responsible AI, and operational control designed into every system from the beginning — not added after the automation is running.",
    url: `${SITE_URL}${PATH}`,
    siteName: "Redmont Strategies Group",
    type: "website",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "The RSG Secure Systems Standard",
    description:
      "Permissions, approvals, backups, logs, testing, and recovery — built in from the start.",
  },
  robots: { index: true, follow: true },
};

export default function SecurityStandardPage() {
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "RSG Secure Systems Standard",
    description:
      "Secure development and responsible-AI practices applied to every website, CRM, automation, private AI system, customer portal, internal dashboard, and custom software project RSG delivers.",
    serviceType: "Secure systems development and responsible AI",
    provider: {
      "@type": "Organization",
      name: "Redmont Strategies Group",
      url: SITE_URL,
    },
    areaServed: [
      { "@type": "AdministrativeArea", name: "Plymouth County, Massachusetts" },
      { "@type": "AdministrativeArea", name: "South Shore, Massachusetts" },
    ],
    url: `${SITE_URL}${PATH}`,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Security", item: `${SITE_URL}${PATH}` },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: SECURITY_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <SecurityPage />
    </PageShell>
  );
}
