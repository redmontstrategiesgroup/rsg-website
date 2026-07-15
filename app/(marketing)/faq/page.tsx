import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { FAQ } from "@/components/home/FAQ";

export const metadata: Metadata = {
  title: "FAQ | Redmont Strategies Group",
  description:
    "Straight answers about how Redmont Strategies Group works: what the first step looks like, whether we replace employees, and how we use AI with a real business purpose.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "FAQ | Redmont Strategies Group",
    description:
      "Straight answers about how Redmont Strategies Group works: what the first step looks like, whether we replace employees, and how we use AI with a real business purpose.",
    url: "/faq",
    images: ["/og.png"],
  },
};

export default function FAQPage() {
  return (
    <PageShell>
      <FAQ headingAs="h1" />
    </PageShell>
  );
}
