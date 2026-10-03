import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getVertical } from "@/lib/industries/store";
import { VERTICAL_ROUTES } from "@/lib/industries/types";
import { VerticalHero } from "@/components/industries/VerticalHero";
import { DispatchBoardVisual } from "@/components/industries/visuals";
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

const SLUG = "home-services" as const;
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

export default async function HomeServicesPage() {
  const vertical = await getVertical(SLUG);
  if (vertical.status !== "published") notFound();

  return (
    <PageShell>
      <VerticalJsonLd vertical={vertical} />
      <VerticalHero vertical={vertical} visual={<DispatchBoardVisual />} />
      <ProblemsSection
        vertical={vertical}
        variant="tickets"
        heading="Five places a service business quietly loses jobs."
      />
      <WorkflowMap vertical={vertical} variant="pipeline" />
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
