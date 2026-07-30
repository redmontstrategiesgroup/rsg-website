import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";
import { DEMO_CONFIGS, demoBySlug } from "@/components/demos/data";
import { DemoOS } from "@/components/demos/DemoOS";
import {
  BuilderSection,
  ConversionSection,
  DemoPageHeader,
  SystemBreakdown,
} from "@/components/demos/sections";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return DEMO_CONFIGS.map((c) => ({ slug: c.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const config = demoBySlug(slug);
  if (!config) return {};
  return {
    title: config.seo.title,
    description: config.seo.description,
    alternates: { canonical: `/demos/${config.slug}` },
    openGraph: {
      title: config.seo.title,
      description: config.seo.description,
      url: `/demos/${config.slug}`,
      images: ["/og.png"],
    },
  };
}

export default async function DemoPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const config = demoBySlug(slug);
  if (!config) notFound();

  const others = DEMO_CONFIGS.filter((c) => c.slug !== config.slug);

  return (
    <PageShell>
      <DemoPageHeader config={config} />

      <section className="container-px pb-6">
        <Reveal delay={0.1}>
          <DemoOS config={config} />
        </Reveal>
      </section>

      <div id="breakdown" className="scroll-mt-24">
        <SystemBreakdown config={config} />
      </div>

      <BuilderSection config={config} />

      <ConversionSection demoSlug={config.slug} cta={config.cta} config={config} />

      {/* Other demo systems */}
      <section className="container-px py-10 sm:py-16">
        <Reveal>
          <span className="label">Keep exploring</span>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {others.map((other) => (
              <Link
                key={other.slug}
                href={`/demos/${other.slug}`}
                className="card group flex items-center justify-between gap-3 px-5 py-4 hover:border-white/25"
              >
                <span>
                  <span className="block text-[0.6rem] font-medium uppercase tracking-[0.16em] text-white/35">
                    {other.industry}
                  </span>
                  <span className="mt-1 block text-sm text-white/80 transition-colors group-hover:text-white">
                    {other.osName}
                  </span>
                </span>
                <ArrowRight
                  size={15}
                  className="shrink-0 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-crimson-light"
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}
