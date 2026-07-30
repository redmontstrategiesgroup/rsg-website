import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { Capabilities } from "@/components/home/Capabilities";
import { OperatingModel } from "@/components/home/OperatingModel";
import { EngagementOptions } from "@/components/home/EngagementOptions";
import { SecurityIncluded } from "@/components/security/SecurityIncluded";

export const metadata: Metadata = {
  title: "Services | Redmont Strategies Group",
  description:
    "Business consulting, AI strategy, custom private AI systems, operations consulting, and web development. Strategy first. Technology second. Execution always.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Services | Redmont Strategies Group",
    description:
      "Business consulting, AI strategy, custom private AI systems, operations consulting, and web development. Strategy first. Technology second. Execution always.",
    url: "/services",
    images: ["/og.png"],
  },
};

export default function ServicesPage() {
  return (
    <PageShell>
      <Capabilities headingAs="h1" />
      <OperatingModel />
      <SecurityIncluded variant="operations" />
      <EngagementOptions />
    </PageShell>
  );
}
