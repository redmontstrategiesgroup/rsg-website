import { ArrowRight, ArrowUpRight, ArrowDownRight, Zap } from "lucide-react";
import { TrackedLink } from "@/components/TrackedLink";
import { formatMetric } from "./engine";
import type { IndustryConfig } from "./types";

/** Static mini render of an industry OS from config data. */
export function MiniPreview({
  config,
  compact = false,
}: {
  config: IndustryConfig;
  compact?: boolean;
}) {
  const metrics = config.metrics.slice(0, 3);
  const stages = config.stages.slice(0, 4);
  const convo = config.conversations[0];
  const lastAuto = convo?.messages.find((m) => m.from === "system");

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-base-900 text-left shadow-card">
      {/* chrome */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] bg-base-800/70 px-3 py-2">
        <span className="flex gap-1" aria-hidden>
          <i className="h-1.5 w-1.5 rounded-full bg-white/15" />
          <i className="h-1.5 w-1.5 rounded-full bg-white/15" />
          <i className="h-1.5 w-1.5 rounded-full bg-white/15" />
        </span>
        <span className="truncate text-[0.6rem] font-medium text-white/60">
          {config.businessName} · {config.osName}
        </span>
        <span className="ml-auto hidden rounded border border-crimson/30 bg-crimson/10 px-1 py-px text-[0.5rem] uppercase tracking-wider text-crimson-light sm:block">
          Demo
        </span>
      </div>
      <div className="space-y-2.5 p-3">
        {/* metrics */}
        <div className="grid grid-cols-3 gap-1.5">
          {metrics.map((m) => {
            const DeltaIcon = m.deltaDir === "down" ? ArrowDownRight : ArrowUpRight;
            const good = m.deltaGood ?? m.deltaDir !== "down";
            return (
              <div key={m.id} className="rounded border border-white/[0.07] bg-white/[0.02] p-1.5">
                <p className="truncate text-[0.5rem] uppercase tracking-wider text-white/35">
                  {m.label}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[0.78rem] font-medium tabular-nums text-white">
                  {formatMetric(m.value, m.format)}
                  {m.delta && (
                    <DeltaIcon
                      size={9}
                      className={good ? "text-emerald-400/80" : "text-red-400/80"}
                      aria-hidden
                    />
                  )}
                </p>
              </div>
            );
          })}
        </div>
        {/* pipeline strip */}
        <div className="flex gap-1.5">
          {stages.map((s) => {
            const count = config.leads.filter((l) => l.stageId === s.id).length;
            return (
              <div
                key={s.id}
                className="flex-1 rounded border border-white/[0.07] bg-white/[0.015] px-1.5 py-1"
              >
                <p className="truncate text-[0.48rem] uppercase tracking-wider text-white/35">
                  {s.label}
                </p>
                <div className="mt-1 flex gap-0.5" aria-hidden>
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <span key={i} className="h-1 flex-1 rounded-sm bg-crimson/50" />
                  ))}
                  {count === 0 && <span className="h-1 flex-1 rounded-sm bg-white/[0.06]" />}
                </div>
              </div>
            );
          })}
        </div>
        {/* automated message */}
        {!compact && lastAuto && (
          <div className="rounded border border-crimson/20 bg-crimson/[0.06] px-2 py-1.5">
            <p className="flex items-center gap-1 text-[0.5rem] uppercase tracking-wider text-crimson-light/80">
              <Zap size={8} aria-hidden /> Automated · {convo.contact}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[0.62rem] leading-snug text-white/65">
              {lastAuto.text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function DirectoryCard({
  config,
  index,
}: {
  config: IndustryConfig;
  index: number;
}) {
  return (
    <article className="group grid gap-8 border-t border-white/10 py-12 lg:grid-cols-12 lg:items-center lg:gap-10 lg:py-16">
      <div className={`lg:col-span-5 ${index % 2 === 1 ? "lg:order-2 lg:col-start-8" : ""}`}>
        <p className="label !text-crimson-light">{config.industry}</p>
        <h3 className="display mt-3 text-xl sm:text-2xl">{config.systemName}</h3>
        <p className="mt-3 text-sm leading-relaxed text-white/55">{config.outcome}</p>
        <ul className="mt-6 space-y-2">
          {config.workflows.map((w) => (
            <li key={w} className="flex items-start gap-2.5 text-sm text-white/60">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-crimson" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <TrackedLink
            href={`/demos/${config.slug}`}
            event="demo_launch_click"
            eventProps={{ demo: config.slug, location: "directory" }}
            className="btn-primary px-6 py-3 text-[0.82rem]"
          >
            Launch Demo
            <ArrowRight size={14} className="ml-2" aria-hidden />
          </TrackedLink>
          <TrackedLink
            href={`/demos/${config.slug}#breakdown`}
            event="demo_launch_click"
            eventProps={{ demo: config.slug, location: "directory_breakdown" }}
            className="link-underline"
          >
            View System Breakdown
          </TrackedLink>
        </div>
      </div>
      <div className={`lg:col-span-6 ${index % 2 === 1 ? "lg:order-1 lg:col-start-1" : "lg:col-start-7"}`}>
        <div className="transition-transform duration-300 group-hover:-translate-y-1">
          <MiniPreview config={config} />
        </div>
      </div>
    </article>
  );
}
