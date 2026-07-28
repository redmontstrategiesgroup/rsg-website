import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { listPlans } from "@/lib/managed-services/store";
import {
  formatMonthlyPrice,
  PARTNERSHIP_LINE,
  SERVICE_PLAN_RECOMMENDATIONS,
} from "@/lib/managed-services/content";
import type { ManagedServicePlan } from "@/lib/managed-services/types";

function PlanSummaryCard({ plan }: { plan: ManagedServicePlan }) {
  return (
    <article className="flex h-full flex-col border border-white/10 bg-white/[0.02] p-6 sm:p-7">
      <h3 className="display text-lg text-white">{plan.name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/50">{plan.tagline}</p>
      <p className="mt-4 text-base font-medium text-white">
        {formatMonthlyPrice(plan)}
      </p>
      <ul className="mt-5 space-y-1.5">
        {plan.features.slice(0, 4).map((feature) => (
          <li key={feature} className="text-sm leading-relaxed text-white/60">
            <span className="mr-2 text-crimson-light">—</span>
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        <Link
          href="/managedservices#plans"
          className="text-sm font-medium text-crimson-light transition-colors hover:text-white"
        >
          View full plan details
        </Link>
      </div>
    </article>
  );
}

/**
 * "What Happens After Launch?" — per-service managed-services recommendation.
 * Async server component; plan pricing comes from listPlans().
 */
export async function AfterLaunchSection({
  service,
  heading,
}: {
  service: string;
  heading?: string;
}) {
  const rec =
    SERVICE_PLAN_RECOMMENDATIONS[service] ??
    SERVICE_PLAN_RECOMMENDATIONS["consulting"]!;

  const plans = await listPlans();
  const primary = plans.find((p) => p.key === rec.primary) ?? null;
  const secondary = rec.secondary
    ? plans.find((p) => p.key === rec.secondary) ?? null
    : null;
  const cards = [primary, secondary].filter(
    (p): p is ManagedServicePlan => p != null
  );

  return (
    <section className="border-y border-white/10 bg-base-900">
      <div className="container-px py-20 sm:py-28">
        <Reveal y={12}>
          <p className="label">Managed Services</p>
        </Reveal>
        <Reveal y={12} delay={0.06}>
          <h2 className="display mt-5 max-w-3xl text-[1.85rem] leading-tight sm:text-[2.4rem]">
            {heading ?? "What Happens After Launch?"}
          </h2>
        </Reveal>
        <Reveal y={12} delay={0.1}>
          <p className="mt-6 max-w-2xl border-l-2 border-crimson/60 pl-5 text-[1.05rem] leading-relaxed text-white/70">
            {PARTNERSHIP_LINE}
          </p>
        </Reveal>
        <Reveal y={12} delay={0.14}>
          <p className="mt-5 max-w-3xl text-[0.98rem] leading-relaxed text-white/55">
            Launch is the starting point, not the finish line. RSG continues
            hosting, maintaining, improving, securing, and expanding the system —
            so it keeps getting faster, safer, and more valuable the longer it
            runs.
          </p>
        </Reveal>

        {rec.required ? (
          <Reveal y={10} delay={0.16}>
            <p className="mt-6 inline-flex items-center border border-crimson/45 bg-crimson/10 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-crimson-light">
              Strongly recommended for this system
            </p>
          </Reveal>
        ) : null}

        {cards.length > 0 ? (
          <div
            className={`mt-12 grid gap-4 ${
              cards.length > 1 ? "md:grid-cols-2" : "md:max-w-md"
            }`}
          >
            {cards.map((plan, i) => (
              <Reveal key={plan.id} y={12} delay={i * 0.06} className="h-full">
                <PlanSummaryCard plan={plan} />
              </Reveal>
            ))}
          </div>
        ) : null}

        <Reveal y={12} delay={0.1}>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-white/40">
            {rec.note}
          </p>
        </Reveal>

        <Reveal y={12} delay={0.14}>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link href="/managedservices" className="btn-primary px-6 py-3.5">
              Explore Managed Services
            </Link>
            <Link href="/book" className="link-underline">
              Schedule a Systems Review
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
