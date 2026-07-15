import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { ProcessList } from "@/components/home/ProcessList";
import { WhyRSGSection } from "@/components/home/WhyRSGSection";

export const metadata: Metadata = {
  title: "Process | Redmont Strategies Group",
  description:
    "A practical framework for building smarter businesses: diagnose, map, strategize, build, optimize.",
  alternates: { canonical: "/process" },
  openGraph: {
    title: "Process | Redmont Strategies Group",
    description:
      "A practical framework for building smarter businesses: diagnose, map, strategize, build, optimize.",
    url: "/process",
    images: ["/og.png"],
  },
};

export default function ProcessPage() {
  return (
    <PageShell>
      <ProcessList headingAs="h1" />
      <WhyRSGSection />
    </PageShell>
  );
}
