import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getVertical } from "@/lib/industries/store";
import { VerticalHero } from "@/components/industries/VerticalHero";
import { LocationGridVisual } from "@/components/industries/visuals";
import { ProblemsSection } from "@/components/industries/ProblemsSection";
import { WorkflowMap } from "@/components/industries/WorkflowMap";
import { SystemsGrid } from "@/components/industries/SystemsGrid";
import { DemoSection } from "@/components/industries/DemoSection";
import { CaseStudySection } from "@/components/industries/CaseStudySection";
import { IntegrationsSection } from "@/components/industries/IntegrationsSection";
import { ComplianceSection } from "@/components/industries/ComplianceSection";
import { AssessmentForm } from "@/components/industries/AssessmentForm";
import { FaqSection } from "@/components/industries/FaqSection";
import { VerticalCtaBand } from "@/components/industries/VerticalCtaBand";
import { VerticalJsonLd } from "@/components/industries/VerticalJsonLd";

const SLUG = "retail" as const;

/** Admin edits show up within 5 minutes without a redeploy. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const v = await getVertical(SLUG);
  return {
    title: v.seo.title,
    description: v.seo.description,
    alternates: { canonical: `/industries/${SLUG}` },
    openGraph: {
      title: v.seo.title,
      description: v.seo.description,
      url: `/industries/${SLUG}`,
      images: ["/og.png"],
    },
    robots: v.status === "published" ? undefined : { index: false, follow: false },
  };
}

/**
 * Retail composition intentionally differs from the other verticals:
 * a tile wall of problems and a looping lifecycle workflow ahead of the
 * systems grid — retail owners think in the shape of the cycle first,
 * tools second.
 */
export default async function RetailPage() {
  const vertical = await getVertical(SLUG);
  if (vertical.status !== "published") notFound();

  return (
    <PageShell>
      <VerticalJsonLd vertical={vertical} />
      <VerticalHero vertical={vertical} visual={<LocationGridVisual />} />
      <ProblemsSection
        vertical={vertical}
        variant="tiles"
        heading="Twelve gaps between your locations, your inventory, and your customers."
      />
      <WorkflowMap vertical={vertical} variant="loop" />
      <SystemsGrid vertical={vertical} />
      <DemoSection vertical={vertical} />
      <CaseStudySection vertical={vertical} />
      <IntegrationsSection vertical={vertical} />
      <ComplianceSection vertical={vertical} />
      <AssessmentForm vertical={vertical} />
      <FaqSection vertical={vertical} />
      <VerticalCtaBand vertical={vertical} />
    </PageShell>
  );
}
