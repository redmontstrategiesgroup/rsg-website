import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import { Manifesto } from "@/components/home/Manifesto";
import { AuditSection } from "@/components/home/AuditSection";
import { Capabilities } from "@/components/home/Capabilities";
import { SecurityStandard } from "@/components/home/SecurityStandard";
import { ProcessList } from "@/components/home/ProcessList";
import { Partnership } from "@/components/home/Partnership";
import { IndustriesList } from "@/components/home/IndustriesList";
import { FinalCTA } from "@/components/home/FinalCTA";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <main>
      <Hero />
      <Manifesto />
      <AuditSection />
      <Capabilities />
      <SecurityStandard />
      <ProcessList />
      <Partnership />
      <IndustriesList />
      <FinalCTA />
    </main>
  );
}
