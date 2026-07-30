import Link from "next/link";
import { Check, ShieldCheck, Workflow, Inbox, Users } from "lucide-react";
import { Reveal, RevealGroup } from "@/components/Reveal";
import { TrackedLink } from "@/components/TrackedLink";
import { BuildSystemCta } from "./BuildSystemCta";
import type { IndustryConfig } from "./types";

/* ------------------------------------------------------------------ */
/* Demo page header                                                    */
/* ------------------------------------------------------------------ */

export function DemoPageHeader({ config }: { config: IndustryConfig }) {
  return (
    <section className="container-px pb-8 pt-9 sm:pt-16">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/demos"
            className="text-[0.75rem] sm:text-[0.68rem] font-medium uppercase tracking-[0.2em] text-white/40 transition-colors hover:text-white"
          >
            Demo Systems
          </Link>
          <span className="text-white/25" aria-hidden>
            /
          </span>
          <span className="label !text-crimson-light">{config.industry}</span>
        </div>
        <h1 className="display mt-5 max-w-3xl text-3xl leading-tight sm:text-4xl lg:text-5xl">
          {config.systemName}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/60">
          {config.description}
        </p>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="mt-8 max-w-3xl border-l-2 border-crimson bg-white/[0.02] px-5 py-4">
          <p className="text-[0.72rem] sm:text-[0.62rem] font-medium uppercase tracking-[0.2em] text-white/40">
            The operational problem
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{config.problem}</p>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Automation builder flow                                             */
/* ------------------------------------------------------------------ */

export function AutomationFlow({
  flow,
}: {
  flow: IndustryConfig["builderFlow"];
}) {
  return (
    <div className="min-w-0 max-w-full overflow-x-auto pb-3 no-scrollbar">
      <ol className="flex min-w-max items-stretch gap-0 px-1 py-2">
        {flow.steps.map((step, i) => (
          <li key={step.label} className="flex items-center">
            <div
              className={`relative w-40 shrink-0 rounded-lg border px-3.5 py-3 ${
                i === 0
                  ? "border-crimson/50 bg-crimson/[0.08]"
                  : i === flow.steps.length - 1
                    ? "border-emerald-500/30 bg-emerald-500/[0.05]"
                    : "border-white/10 bg-white/[0.025]"
              }`}
            >
              <span className="absolute -top-2 left-3 rounded bg-base px-1.5 text-[0.7rem] sm:text-[0.55rem] font-medium uppercase tracking-wider text-white/35">
                {i === 0 ? "Trigger" : `Step ${i}`}
              </span>
              <p className="text-xs font-medium leading-snug text-white/85">{step.label}</p>
              {step.sub && <p className="mt-1 text-[0.72rem] sm:text-[0.62rem] leading-snug text-white/40">{step.sub}</p>}
            </div>
            {i < flow.steps.length - 1 && (
              <span className="relative mx-1 block h-px w-6 shrink-0 bg-white/20" aria-hidden>
                <span className="absolute -right-0.5 -top-[3px] border-b-[3.5px] border-l-[5px] border-t-[3.5px] border-b-transparent border-l-white/30 border-t-transparent" />
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function BuilderSection({ config }: { config: IndustryConfig }) {
  return (
    <section className="container-px py-10 sm:py-20">
      <Reveal>
        <span className="label">Automation builder</span>
        <h2 className="display mt-4 text-2xl sm:text-3xl">
          Under the hood: {config.builderFlow.title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
          Every workflow in this demo is a sequence your team can see, edit, pause, and approve —
          not a black box.
        </p>
      </Reveal>
      <Reveal delay={0.1} className="mt-8">
        <div className="rounded-xl border border-white/10 bg-base-900/60 p-4 sm:p-6">
          <AutomationFlow flow={config.builderFlow} />
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* System breakdown                                                    */
/* ------------------------------------------------------------------ */

export function SystemBreakdown({ config }: { config: IndustryConfig }) {
  const cols = [
    {
      icon: Inbox,
      title: "What enters the system",
      items: config.breakdown.inputs,
    },
    {
      icon: Workflow,
      title: "What the system does",
      items: config.breakdown.systemDoes,
    },
    {
      icon: Users,
      title: "What your team still controls",
      items: config.breakdown.teamControls,
    },
  ];
  return (
    <section className="border-y border-white/[0.07] bg-base-900/40">
      <div className="container-px py-10 sm:py-20">
        <Reveal>
          <span className="label">System breakdown</span>
          <h2 className="display mt-4 max-w-2xl text-2xl sm:text-3xl">
            Automation does the chasing. Your team does the judging.
          </h2>
        </Reveal>
        <div className="section-grid mt-10">
          {cols.map((col, i) => {
            const Icon = col.icon;
            return (
              <Reveal key={col.title} delay={i * 0.08} className="lg:col-span-4">
                <div className="h-full border-t border-white/15 pt-6">
                  <div className="flex items-center gap-2.5">
                    <Icon size={15} className="text-crimson-light" aria-hidden />
                    <h3 className="text-sm font-medium text-white">{col.title}</h3>
                  </div>
                  <ul className="mt-5 space-y-2.5">
                    {col.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-white/55">
                        <Check size={13} className="mt-0.5 shrink-0 text-white/30" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-9 sm:mt-14">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={15} className="text-crimson-light" aria-hidden />
            <h3 className="text-sm font-medium text-white">Potential integrations</h3>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/45">
            Configured per engagement around the tools you already run — shown here as options, not
            live connections.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {config.breakdown.integrations.map((integration) => (
              <li
                key={integration}
                className="rounded border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60"
              >
                {integration}
                <span className="ml-2 text-[0.7rem] sm:text-[0.58rem] uppercase tracking-wider text-white/30">
                  Configurable
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Industry CTA banner + conversion section                            */
/* ------------------------------------------------------------------ */

const IMPLEMENTATION_STEPS = [
  {
    n: "01",
    title: "Diagnose the current operation",
    body: "We map how leads, customers, and admin work actually move through your business today — and where revenue leaks out.",
  },
  {
    n: "02",
    title: "Design the operating system",
    body: "Workflows, sequences, and handoffs designed around your tools, your team, and your customer journey. Nothing generic.",
  },
  {
    n: "03",
    title: "Build, integrate, test, and optimize",
    body: "We implement, connect your existing platforms, test against real scenarios, and tune the system as it runs.",
  },
];

/**
 * The single conversion block on a demo page. When an industry `cta` is
 * provided, its headline/button become the one ask — no stacked banners.
 */
export function ConversionSection({
  demoSlug,
  cta,
  config,
}: {
  demoSlug?: string;
  cta?: IndustryConfig["cta"];
  /** When provided, the CTA opens the explore/request dialog instead of linking to /book. */
  config?: IndustryConfig;
}) {
  return (
    <section className="border-t border-white/[0.07] bg-base-900/40">
      <div className="container-px py-12 sm:py-24">
        <div className="section-grid items-start">
          <Reveal className="lg:col-span-5">
            <span className="label">Implementation</span>
            <h2 className="display mt-4 text-2xl leading-tight sm:text-3xl">
              {cta ? cta.headline : "This Is Only the Starting Point"}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/55">
              Every RSG operating system is configured around the company&apos;s existing tools,
              customer journey, team responsibilities, bottlenecks, and growth priorities.
            </p>
            <div className="mt-8">
              {config ? (
                <BuildSystemCta config={config} source="conversion_section" />
              ) : (
                <TrackedLink
                  href="/book"
                  event="demo_cta_click"
                  eventProps={{ demo: demoSlug ?? "landing", cta: "consultation" }}
                  className="btn-primary"
                >
                  {cta ? cta.button : "Book a Systems Consultation"}
                </TrackedLink>
              )}
            </div>
          </Reveal>
          <RevealGroup className="space-y-0 lg:col-span-6 lg:col-start-7">
            {IMPLEMENTATION_STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 0.08}>
                <div className="flex gap-6 border-t border-white/10 py-6 last:border-b">
                  <span className="font-mono text-sm text-crimson-light/80">{step.n}</span>
                  <div>
                    <h3 className="text-sm font-medium text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/50">{step.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}
