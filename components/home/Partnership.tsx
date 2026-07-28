import Link from "next/link";
import { Reveal } from "../Reveal";
import { PARTNERSHIP_LINE } from "@/lib/managed-services/content";

const VALUE_POINTS = [
  {
    title: "Managed hosting & security",
    body: "Hosting, backups, updates, and security monitoring handled continuously — so the systems behind your business stay fast, protected, and reliable.",
  },
  {
    title: "Continuous improvement",
    body: "Conversion, speed, and workflow improvements shipped every month, backed by real analytics instead of guesswork.",
  },
  {
    title: "Strategic system development",
    body: "New automations, AI improvements, and integrations built as your business grows — with a roadmap you approve.",
  },
];

export function Partnership() {
  return (
    <section id="partnership" className="border-y border-white/10 bg-base-900">
      <div className="container-px py-20 sm:py-28">
        <div className="section-grid">
          <div className="lg:col-span-5">
            <Reveal y={12}>
              <p className="label">Ongoing Partnership</p>
            </Reveal>
            <Reveal y={12} delay={0.08}>
              <h2 className="display mt-6 text-[2.1rem] leading-[1.08] sm:text-[2.8rem]">
                We don&rsquo;t launch and leave.
              </h2>
            </Reveal>
            <Reveal y={12} delay={0.16}>
              <p className="mt-8 max-w-md border-l-2 border-crimson/60 pl-5 text-[1.05rem] leading-relaxed text-white/70">
                {PARTNERSHIP_LINE}
              </p>
            </Reveal>
            <Reveal y={12} delay={0.22}>
              <Link href="/managedservices" className="btn-ghost mt-10 inline-flex">
                Explore Managed Services
              </Link>
            </Reveal>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <div className="grid gap-4">
              {VALUE_POINTS.map((point, i) => (
                <Reveal key={point.title} y={12} delay={0.1 + i * 0.06}>
                  <div className="border border-white/10 bg-white/[0.02] p-6 sm:p-7">
                    <p className="text-[1.02rem] font-medium text-white">
                      {point.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/50">
                      {point.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
