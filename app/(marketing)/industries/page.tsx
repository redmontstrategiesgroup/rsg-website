import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { IndustriesList } from "@/components/home/IndustriesList";

export const metadata: Metadata = {
  title: "Industries | Redmont Strategies Group",
  description:
    "Built for service businesses where speed, trust, and follow-up matter: med spas, clinics, gyms, dental offices, contractors, and high-ticket service providers.",
};

export default function IndustriesPage() {
  return (
    <PageShell>
      <IndustriesList />
    </PageShell>
  );
}
