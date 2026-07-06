import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { FinalCTA } from "@/components/home/FinalCTA";

export const metadata: Metadata = {
  title: "Contact | Book a Strategy Call — Redmont Strategies Group",
  description:
    "Tell us about your business and we'll map where you're losing time, leads, and opportunities. Every engagement starts with a strategy call.",
};

export default function ContactPage() {
  return (
    <PageShell>
      <FinalCTA />
    </PageShell>
  );
}
