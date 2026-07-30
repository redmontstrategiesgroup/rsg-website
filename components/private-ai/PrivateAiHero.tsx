"use client";

import Link from "next/link";
import { ArrowRight, Shield, Server, Lock, Users, Headphones } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { PRIVATE_AI_PATH, TRUST_INDICATORS } from "@/lib/private-ai/content";

const TRUST_ICONS = [Shield, Server, Lock, Users, Headphones];

export function PrivateAiHero() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.08]">
      {/* Decorative only — hidden on phones, where the blur and grid cost
          compositing work and add nothing to the message. */}
      <div className="pointer-events-none absolute inset-0 -z-10 hidden sm:block">
        <div className="absolute inset-0 bg-grid opacity-[0.18]" />
        <div className="absolute left-1/2 top-[-20%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-crimson/[0.08] blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[280px] w-[420px] rounded-full bg-white/[0.03] blur-[100px]" />
      </div>

      <div className="container-px pb-16 pt-14 sm:pb-24 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <Reveal y={12}>
              <nav
                aria-label="Breadcrumb"
                className="flex flex-wrap items-center text-sm text-white/40"
              >
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center hover:text-white/70 lg:min-h-0"
                >
                  Home
                </Link>
                <span className="mx-2">/</span>
                <Link
                  href="/services"
                  className="inline-flex min-h-11 items-center hover:text-white/70 lg:min-h-0"
                >
                  Services
                </Link>
                <span className="mx-2">/</span>
                <span className="text-white/60">Custom Private AI Systems</span>
              </nav>
            </Reveal>
            <Reveal y={12} delay={0.05}>
              <p className="label mt-8">Custom Private AI Systems</p>
            </Reveal>
            <Reveal y={12} delay={0.1}>
              <h1 className="display mt-5 max-w-3xl text-[2.15rem] leading-[1.08] tracking-tight sm:text-[3.1rem]">
                Custom AI built around your business—not the other way around.
              </h1>
            </Reveal>
            <Reveal y={12} delay={0.16}>
              <p className="mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-white/55">
                Secure, business-specific AI systems deployed locally, privately,
                or within your existing infrastructure.
              </p>
            </Reveal>
            <Reveal y={12} delay={0.2}>
              <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-white/45">
                Build an AI system that understands your business without exposing
                your business. RSG develops custom AI assistants, automation
                platforms, knowledge systems, and operational tools that can run
                locally, privately, or inside your existing cloud environment.
              </p>
            </Reveal>
            <Reveal y={12} delay={0.24}>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href={`/book?service=custom-private-ai`}
                  className="btn-primary inline-flex items-center gap-2 px-6 py-3.5"
                >
                  Design My AI System
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="#private-ai-designer"
                  className="btn-ghost inline-flex items-center gap-2 px-6 py-3.5"
                >
                  Explore the Demo
                </a>
              </div>
            </Reveal>
            <Reveal y={12} delay={0.28}>
              <ul className="mt-10 flex flex-wrap gap-x-5 gap-y-3">
                {TRUST_INDICATORS.map((label, i) => {
                  const Icon = TRUST_ICONS[i] ?? Shield;
                  return (
                    <li
                      key={label}
                      className="inline-flex items-center gap-2 text-sm text-white/45"
                    >
                      <Icon size={14} className="text-crimson-light" aria-hidden />
                      {label}
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          </div>

          <div className="lg:col-span-5">
            <Reveal y={16} delay={0.12}>
              <div
                className="relative overflow-hidden rounded-2xl border border-white/12 bg-base-900/80 p-6 sm:p-8"
                aria-hidden
              >
                <p className="font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-crimson-light">
                  Controlled environment
                </p>
                <div className="mt-5 space-y-3">
                  {[
                    { label: "Company data layer", tone: "border-white/15 bg-white/[0.04]" },
                    { label: "Permission & audit layer", tone: "border-crimson/30 bg-crimson/[0.08]" },
                    { label: "Private model runtime", tone: "border-white/15 bg-white/[0.04]" },
                    { label: "Approved integrations", tone: "border-white/10 bg-white/[0.025]" },
                    { label: "Human approval gates", tone: "border-white/15 bg-white/[0.04]" },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className={`rounded-lg border px-4 py-3 text-sm text-white/70 ${row.tone}`}
                    >
                      {row.label}
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-xs leading-relaxed text-white/35">
                  Sensitive documents, customer records, and proprietary knowledge
                  stay inside environments you control—not public AI platforms.
                </p>
                <Link
                  href={PRIVATE_AI_PATH + "#security"}
                  className="mt-4 inline-flex min-h-11 items-center text-sm text-crimson-light hover:underline lg:min-h-0"
                >
                  View security architecture
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
