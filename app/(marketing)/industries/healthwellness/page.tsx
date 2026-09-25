import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getVertical } from "@/lib/industries/store";
import { VERTICAL_ROUTES } from "@/lib/industries/types";
import { VerticalHero } from "@/components/industries/VerticalHero";
import { TreatmentRoomScheduleVisual } from "@/components/industries/visuals";
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

const SLUG = "health-wellness" as const;
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
 * Health & wellness composition intentionally differs from the other
 * verticals: a front-desk ledger for problems and a vertical client-journey
 * workflow, because the pitch here is about a pipeline that leaks between
 * stages rather than a queue of jobs moving left to right.
 */
export default async function HealthWellnessPage() {
  const vertical = await getVertical(SLUG);
  if (vertical.status !== "published") notFound();

  return (
    <PageShell>
      <VerticalJsonLd vertical={vertical} />
      <VerticalHero vertical={vertical} visual={<TreatmentRoomScheduleVisual />} />
      <ProblemsSection
        vertical={vertical}
        variant="ledger"
        heading="Five front-desk breakdowns that drain a practice."
      />
      <WorkflowMap vertical={vertical} variant="journey" />
      <SystemsGrid vertical={vertical} />
      <DemoSection vertical={vertical} />
      <CaseStudySection vertical={vertical} />
      <IntegrationsSection vertical={vertical} />
      <ComplianceSection vertical={vertical} />
      <FaqSection vertical={vertical} />
      <AssessmentForm vertical={vertical} />
    </PageShell>
  );
}
