import { Hero } from "@/components/home/Hero";
import { Manifesto } from "@/components/home/Manifesto";
import { Capabilities } from "@/components/home/Capabilities";
import { OperatingModel } from "@/components/home/OperatingModel";
import { ProcessList } from "@/components/home/ProcessList";
import { IndustriesList } from "@/components/home/IndustriesList";
import { EngagementOptions } from "@/components/home/EngagementOptions";
import { WhyRSGSection } from "@/components/home/WhyRSGSection";
import { FinalCTA } from "@/components/home/FinalCTA";

export default function Home() {
  return (
    <main>
      <Hero />
      <Manifesto />
      <Capabilities />
      <OperatingModel />
      <ProcessList />
      <IndustriesList />
      <EngagementOptions />
      <WhyRSGSection />
      <FinalCTA />
    </main>
  );
}
