import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { PrivateAiHero } from "@/components/private-ai/PrivateAiHero";
import { DeploymentCompare } from "@/components/private-ai/DeploymentCompare";
import { SystemDesigner } from "@/components/private-ai/SystemDesigner";
import {
  SystemsGrid,
  SecuritySection,
  ModelOptionsSection,
  IntegrationsSection,
  IndustryUseCases,
  ProcessSection,
  PrivateAiFaq,
  PrivateAiCta,
} from "@/components/private-ai/sections";
import { PRIVATE_AI_FAQS, PRIVATE_AI_PATH } from "@/lib/private-ai/content";
import { AfterLaunchSection } from "@/components/managed-services/AfterLaunch";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Custom Private AI Systems | Redmont Strategies Group",
  description:
    "Custom private AI systems designed around your workflows, data, and security requirements. Deploy locally, on-premise, in private cloud, hybrid, or RSG-managed environments.",
  alternates: { canonical: `${SITE_URL}${PRIVATE_AI_PATH}` },
  openGraph: {
    title: "Custom Private AI Systems | Redmont Strategies Group",
    description:
      "Secure, business-specific AI systems deployed locally, privately, or within your existing infrastructure.",
    url: `${SITE_URL}${PRIVATE_AI_PATH}`,
    siteName: "Redmont Strategies Group",
    type: "website",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Custom Private AI Systems | Redmont Strategies Group",
    description:
      "Custom AI built around your business—not the other way around. Local, on-premise, private cloud, hybrid, or managed.",
  },
  robots: { index: true, follow: true },
};

export default function CustomPrivateAiSystemsPage() {
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Custom Private AI Systems",
    description:
      "Design, build, deploy, and maintain custom AI systems tailored to a company’s workflows, data, security requirements, and existing technology—with local, on-premise, private cloud, hybrid, and managed deployment options.",
    serviceType: "Custom private AI systems",
    provider: {
      "@type": "Organization",
      name: "Redmont Strategies Group",
      url: SITE_URL,
    },
    areaServed: [
      { "@type": "AdministrativeArea", name: "Plymouth County, Massachusetts" },
      { "@type": "AdministrativeArea", name: "South Shore, Massachusetts" },
    ],
    url: `${SITE_URL}${PRIVATE_AI_PATH}`,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Services",
        item: `${SITE_URL}/services`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Custom Private AI Systems",
        item: `${SITE_URL}${PRIVATE_AI_PATH}`,
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PRIVATE_AI_FAQS.map((faq) => ({
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
      <PrivateAiHero />
      <DeploymentCompare />
      <SystemsGrid />
      <SecuritySection />
      <ModelOptionsSection />
      <IntegrationsSection />
      <IndustryUseCases />
      <SystemDesigner />
      <ProcessSection />
      <AfterLaunchSection
        service="private_ai"
        heading="What Happens After Deployment?"
      />
      <PrivateAiFaq />
      <PrivateAiCta />
    </PageShell>
  );
}
