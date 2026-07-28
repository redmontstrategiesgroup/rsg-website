import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEMO_CONFIGS, demoBySlug } from "@/components/demos/data";
import { DemoOS } from "@/components/demos/DemoOS";

/**
 * Chrome-free demo render used by the mobile-preview iframe on /demos/[slug].
 * Shares the visitor's localStorage session with the parent page, so both
 * views show the same live data.
 */

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return DEMO_CONFIGS.map((c) => ({ slug: c.slug }));
}

export const dynamicParams = false;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DemoPreviewPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const config = demoBySlug(slug);
  if (!config) notFound();

  return (
    <main className="min-h-screen bg-base p-2">
      <DemoOS config={config} embedded />
    </main>
  );
}
