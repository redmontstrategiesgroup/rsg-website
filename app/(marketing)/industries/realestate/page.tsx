import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getVertical } from "@/lib/industries/store";
import { VERTICAL_ROUTES } from "@/lib/industries/types";
import { VerticalHero } from "@/components/industries/VerticalHero";
import { ListingPipelineVisual } from "@/components/industries/visuals";
import { ProblemsSection } from "@/components/industries/ProblemsSection";
import { WorkflowMap } from "@/components/industries/WorkflowMap";
import { SystemsGrid } from "@/components/industries/SystemsGrid";
import { DemoSection } from "@/components/industries/DemoSection";
import { CaseStudySection } from "@/components/industries/CaseStudySection";
import { IntegrationsSection } from "@/components/industries/IntegrationsSection";
import { ComplianceSection } from "@/components/industries/ComplianceSection";
import { AssessmentForm } from "@/components/industries/AssessmentForm";
import { FaqSection } from "@/components/industries/FaqSection";
import { VerticalJsonLd } from "@/components/industries/VerticalJsonLd";

const SLUG = "real-estate" as const;
const ROUTE = VERTICAL_ROUTES[SLUG];

/** Admin edits show up within 5 minutes without a redeploy. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const v = await getVertical(SLUG);
  return {
    title: v.seo.title,
    description: v.seo.description,
    alternates: { canonical: ROUTE },
    openGraph: {
      title: v.seo.title,
      description: v.seo.description,
      url: ROUTE,
      images: ["/og.png"],
    },
    robots: v.status === "published" ? undefined : { index: false, follow: false },
  };
}

/**
 * Real estate composition intentionally differs from the other verticals:
 * a tile wall of failure points and a looping lifecycle workflow ahead of
 * the systems grid — a brokerage's pipeline genuinely closes on itself,
 * since today's closing is next year's referral source.
 */
export default async function RealEstatePage() {
  const vertical = await getVertical(SLUG);
  if (vertical.status !== "published") notFound();

  return (
    <PageShell>
      <VerticalJsonLd vertical={vertical} />
      <VerticalHero vertical={vertical} visual={<ListingPipelineVisual />} />
      <ProblemsSection
        vertical={vertical}
        variant="tiles"
        heading="Twelve places a lead, a showing, or a deadline goes missing."
      />
      <WorkflowMap vertical={vertical} variant="loop" />
      <SystemsGrid vertical={vertical} />
      <DemoSection vertical={vertical} />
      <CaseStudySection vertical={vertical} />
      <IntegrationsSection vertical={vertical} />
      <ComplianceSection vertical={vertical} />
      <AssessmentForm vertical={vertical} />
      <FaqSection vertical={vertical} />
    </PageShell>
  );
}
