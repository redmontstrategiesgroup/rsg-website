"use client";

import { useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ArrowRight, MousePointerClick, Send } from "lucide-react";
import { trackEvent } from "@/lib/events";
import type { IndustryConfig } from "./types";
import { Modal } from "./ui/Modal";
import { RequestSystemDialog } from "./RequestSystemDialog";

/**
 * "Build This System" call to action. Instead of dumping the visitor on a
 * generic contact page, it opens a two-path dialog:
 *   1. jump straight into the interactive demo (no account, no form), or
 *   2. request this system for their business (consultation form that carries
 *      the demo context and explored features with it).
 */
export function BuildSystemCta({
  config,
  label,
  className = "btn-primary",
  source = "conversion_section",
  children,
}: {
  config: IndustryConfig;
  label?: string;
  className?: string;
  source?: string;
  children?: ReactNode;
}) {
  const [step, setStep] = useState<"closed" | "choose" | "request">("closed");
  const router = useRouter();
  const pathname = usePathname();
  const onDemoPage = pathname?.startsWith(`/demos/${config.slug}`);

  const open = () => {
    trackEvent("demo_cta_click", { demo: config.slug, cta: "build_modal", source });
    setStep("choose");
  };

  const exploreDemo = () => {
    trackEvent("demo_cta_click", { demo: config.slug, cta: "explore_demo", source });
    setStep("closed");
    if (onDemoPage) {
      document.getElementById("demo-os")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      router.push(`/demos/${config.slug}#demo-os`);
    }
  };

  return (
    <>
      <button type="button" onClick={open} className={className}>
        {children ?? (
          <>
            {label ?? config.cta.button}
            <ArrowRight size={15} className="ml-2" aria-hidden />
          </>
        )}
      </button>

      {step === "choose" && (
        <Modal
          title={config.cta.button}
          subtitle={`${config.systemName} — pick how you'd like to start`}
          onClose={() => setStep("closed")}
        >
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={exploreDemo}
              className="group flex w-full items-start gap-3.5 rounded-lg border border-white/12 bg-white/[0.02] p-4 text-left transition-colors hover:border-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                <MousePointerClick size={15} className="text-white/60" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium text-white">
                  Explore the interactive demo
                  <ArrowRight size={13} className="text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-crimson-light" aria-hidden />
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-white/50">
                  Open the working {config.osName} right now — add {config.terminology.records.toLowerCase()},
                  run automations, talk to the AI receptionist. No account, no form.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStep("request")}
              className="group flex w-full items-start gap-3.5 rounded-lg border border-crimson/35 bg-crimson/[0.06] p-4 text-left transition-colors hover:border-crimson/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-crimson/30 bg-crimson/10">
                <Send size={14} className="text-crimson-light" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium text-white">
                  Request this system for my business
                  <ArrowRight size={13} className="text-crimson-light/50 transition-transform group-hover:translate-x-1 group-hover:text-crimson-light" aria-hidden />
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-white/50">
                  A short request form — we&apos;ll include the demo you viewed and the features you
                  tried, and follow up within one business day.
                </span>
              </span>
            </button>
          </div>
        </Modal>
      )}

      {step === "request" && (
        <RequestSystemDialog config={config} source={source} onClose={() => setStep("closed")} />
      )}
    </>
  );
}
