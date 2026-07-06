import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { Capabilities } from "@/components/home/Capabilities";
import { OperatingModel } from "@/components/home/OperatingModel";
import { EngagementOptions } from "@/components/home/EngagementOptions";

export const metadata: Metadata = {
  title: "Services | Redmont Strategies Group",
  description:
    "Business consulting, AI strategy and implementation, marketing and lead conversion, and web development. Strategy first. Technology second. Execution always.",
};

export default function ServicesPage() {
  return (
    <PageShell>
      <Capabilities />
      <OperatingModel />
      <EngagementOptions />
    </PageShell>
  );
}
