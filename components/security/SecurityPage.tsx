"use client";

import Link from "next/link";
import { ArrowRight, Plus, Check } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { trackEvent } from "@/lib/events";
import { PHONE_DISPLAY, PHONE_TEL } from "@/lib/site";
import {
  SECURITY_PILLARS,
  FRAMEWORK_STAGES,
  OWASP_AI_RISKS,
  COMPLIANCE_STATEMENTS,
  SECURITY_FAQS,
  HOMEPAGE_CONTROL_GRID,
} from "@/lib/security-center/marketing";
import {
  APPROVAL_STATUS_LABELS,
  SECURITY_PACKAGES,
} from "@/lib/security-center/catalog";

/* --------------------------------- Hero -------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.08]">
      {/* Decorative only — hidden on phones, where the blur and grid cost
          compositing work and add nothing to the message. */}
      <div className="pointer-events-none absolute inset-0 -z-10 hidden sm:block">
        <div className="absolute inset-0 bg-grid opacity-[0.16]" />
        <div className="absolute left-1/2 top-[-20%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-crimson/[0.08] blur-[140px]" />
      </div>
      <div className="container-px py-16 sm:py-32">
        <nav
          aria-label="Breadcrumb"
          className="mb-8 flex items-center gap-2 text-xs text-white/40"
        >
          <Link
            href="/"
            className="inline-flex min-h-11 items-center transition-colors hover:text-white/70 lg:min-h-0"
          >
            Home
          </Link>
          <span>/</span>
          <span className="text-white/60">Security</span>
        </nav>
        <Reveal y={12}>
          <p className="label">The RSG Secure Systems Standard</p>
        </Reveal>
        <Reveal y={12} delay={0.08}>
          <h1 className="display mt-6 max-w-4xl text-[2.4rem] leading-[1.05] sm:text-[3.4rem]">
            AI automation without security is a{" "}
            <span className="text-white/40">liability.</span>
          </h1>
        </Reveal>
        <Reveal y={12} delay={0.14}>
          <p className="mt-7 max-w-2xl text-[1.05rem] leading-relaxed text-white/60">
            RSG does not simply connect tools and hope they work. Permissions,
            approvals, backups, logs, testing, and recovery procedures are
            designed into every system from the beginning — because these systems
            run real business operations and hold sensitive data.
          </p>
        </Reveal>
        <Reveal y={12} delay={0.2}>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/book"
              onClick={() => trackEvent("security_cta_click", { location: "hero", cta: "discuss" })}
              className="btn-primary"
            >
              Discuss a Secure System
            </Link>
            <Link
              href="/audit"
              onClick={() => trackEvent("security_cta_click", { location: "hero", cta: "risk_assessment" })}
              className="btn-ghost"
            >
              Request a Risk Assessment
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------- Philosophy ------------------------------ */

const PHILOSOPHY = [
  {
    title: "Security is part of the build",
    body: "RSG systems are designed with controlled access, secure credentials, backups, audit trails, responsible-AI safeguards, and documented recovery from the beginning. Security is not added after the automation is already running.",
  },
  {
    title: "AI should not have unlimited authority",
    body: "RSG can require human approval before an AI system sends sensitive communications, changes records, approves financial actions, releases documents, or performs other high-risk tasks.",
  },
  {
    title: "Know where your data goes",
    body: "RSG documents the third-party platforms involved in each system, what they are used for, and what categories of information they may process.",
  },
  {
    title: "Built for accountability",
    body: "Important administrative, customer-data, and AI actions can be logged so a business understands what happened, who authorized it, and which records were affected.",
  },
];

function Philosophy() {
  return (
    <section id="philosophy" className="scroll-mt-24 border-b border-white/[0.08]">
      <div className="container-px section-y">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Security-first development</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-6 text-[1.9rem] leading-tight sm:text-[2.5rem]">
              A standard applied to every website, CRM, automation, portal, and
              custom system RSG delivers
            </h2>
          </Reveal>
          <Reveal y={12} delay={0.14}>
            <p className="mt-6 text-[1.02rem] leading-relaxed text-white/55">
              RSG evaluates every project across the areas below. Which controls
              a system receives depends on what it does and the data it holds —
              security is selected to fit the project, not sold as a fixed bundle.
            </p>
          </Reveal>
        </div>
        <div className="mt-9 sm:mt-14 grid gap-3 sm:grid-cols-2">
          {PHILOSOPHY.map((p, i) => (
            <Reveal key={p.title} y={12} delay={(i % 2) * 0.06}>
              <div className="h-full border border-white/10 bg-white/[0.02] p-6 sm:p-7">
                <h3 className="display text-xl text-white">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Pillars ------------------------------- */

function Pillars() {
  return (
    <section id="standard" className="scroll-mt-24 border-b border-white/[0.08]">
      <div className="container-px section-y">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">The standard, area by area</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-6 text-[1.9rem] leading-tight sm:text-[2.5rem]">
              Ten areas RSG evaluates on every project
            </h2>
          </Reveal>
        </div>

        <div className="mt-9 sm:mt-14 space-y-4">
          {SECURITY_PILLARS.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <Reveal key={pillar.id} y={12} delay={(i % 3) * 0.05}>
                <article
                  id={pillar.id}
                  className="scroll-mt-28 border border-white/10 bg-white/[0.02] p-6 sm:p-8"
                >
                  <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
                    <div>
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-crimson-light">
                        <Icon size={18} />
                      </span>
                      <p className="label mt-5">{pillar.eyebrow}</p>
                      <h3 className="display mt-3 text-xl text-white">{pillar.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-white/55">{pillar.intro}</p>
                    </div>
                    <div>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {pillar.controls.map((c) => (
                          <li
                            key={c}
                            className="flex items-start gap-2.5 border border-white/[0.08] bg-white/[0.015] px-3.5 py-2.5 text-sm text-white/65"
                          >
                            <Check size={14} className="mt-0.5 shrink-0 text-crimson-light" />
                            {c}
                          </li>
                        ))}
                      </ul>
                      {pillar.note && (
                        <p className="mt-4 border-l-2 border-crimson/40 pl-4 text-sm leading-relaxed text-white/50">
                          {pillar.note}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- AI approval flow -------------------------- */

const APPROVAL_FLOW: { key: string; label: string }[] = [
  { key: "drafted", label: APPROVAL_STATUS_LABELS.drafted },
  { key: "awaiting_approval", label: APPROVAL_STATUS_LABELS.awaiting_approval },
  { key: "approved", label: APPROVAL_STATUS_LABELS.approved },
  { key: "executed", label: APPROVAL_STATUS_LABELS.executed },
];

const HIGH_RISK = [
  "Sending contracts",
  "Issuing refunds",
  "Changing pricing",
  "Deleting records",
  "Approving estimates",
  "Modifying permissions",
  "Sharing confidential documents",
  "Making financial commitments",
  "Publishing public content",
  "Sending sensitive customer communications",
  "Scheduling expensive work",
  "Executing database or infrastructure changes",
];

function ApprovalFlow() {
  return (
    <section id="ai-approvals" className="scroll-mt-24 border-b border-white/[0.08]">
      <div className="container-px section-y">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Human-in-the-loop</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-6 text-[1.9rem] leading-tight sm:text-[2.5rem]">
              High-risk AI actions wait for a human decision
            </h2>
          </Reveal>
          <Reveal y={12} delay={0.14}>
            <p className="mt-6 text-[1.02rem] leading-relaxed text-white/55">
              When an AI feature drafts a high-risk action, it does not execute
              automatically. It enters an approval queue where a person can
              approve, reject, edit, or escalate — and every AI action can be
              logged.
            </p>
          </Reveal>
        </div>

        {/* Flow */}
        <Reveal y={12} delay={0.16}>
          <div className="mt-8 sm:mt-12 flex flex-wrap items-center gap-3">
            {APPROVAL_FLOW.map((s, i) => (
              <div key={s.key} className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 border border-white/10 bg-white/[0.02] px-4 py-3">
                  <span className="font-mono text-xs text-crimson-light">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-sm text-white/75">{s.label}</span>
                </div>
                {i < APPROVAL_FLOW.length - 1 && (
                  <ArrowRight size={16} className="text-white/25" />
                )}
              </div>
            ))}
            <div className="flex items-center gap-3">
              <ArrowRight size={16} className="text-white/25" />
              <div className="border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/45">
                or Rejected / Escalated
              </div>
            </div>
          </div>
        </Reveal>

        <div className="mt-10">
          <p className="label">Actions that require deliberate authorization</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {HIGH_RISK.map((h) => (
              <div
                key={h}
                className="border border-white/[0.08] bg-white/[0.015] px-3.5 py-2.5 text-sm text-white/60"
              >
                {h}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Framework-informed ------------------------ */

function Framework() {
  return (
    <section id="framework" className="scroll-mt-24 border-b border-white/[0.08]">
      <div className="container-px section-y">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Framework-informed development</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-6 text-[1.9rem] leading-tight sm:text-[2.5rem]">
              Informed by NIST and OWASP guidance
            </h2>
          </Reveal>
          <Reveal y={12} delay={0.14}>
            <p className="mt-6 text-[1.02rem] leading-relaxed text-white/55">
              The RSG Secure Systems Standard is informed by established security
              and responsible-AI principles. RSG organizes its internal AI risk
              process around four stages.
            </p>
          </Reveal>
        </div>

        <div className="mt-8 sm:mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FRAMEWORK_STAGES.map((stage, i) => (
            <Reveal key={stage.name} y={12} delay={(i % 4) * 0.05}>
              <div className="h-full border border-white/10 bg-white/[0.02] p-5">
                <h3 className="display text-lg text-white">{stage.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/50">{stage.summary}</p>
                <ul className="mt-4 space-y-1.5">
                  {stage.items.map((it) => (
                    <li key={it} className="flex gap-2 text-xs text-white/55">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-crimson-light" />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        {/* OWASP risks */}
        <div className="mt-8 sm:mt-12">
          <p className="label">OWASP-informed AI risks, in plain terms</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {OWASP_AI_RISKS.map((r) => (
              <div key={r.risk} className="border border-white/[0.08] bg-white/[0.015] p-4">
                <p className="text-sm font-medium text-white/85">{r.risk}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/50">{r.how}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance posture */}
        <div className="mt-8 sm:mt-12 border border-white/10 bg-white/[0.02] p-6 sm:p-7">
          <p className="label">An honest word on compliance</p>
          <ul className="mt-4 space-y-2.5">
            {COMPLIANCE_STATEMENTS.map((s) => (
              <li key={s} className="flex gap-3 text-sm leading-relaxed text-white/60">
                <Check size={15} className="mt-0.5 shrink-0 text-crimson-light" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Packages ------------------------------- */

function Packages() {
  return (
    <section id="packages" className="scroll-mt-24 border-b border-white/[0.08]">
      <div className="container-px section-y">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Security packaging</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-6 text-[1.9rem] leading-tight sm:text-[2.5rem]">
              Security scaled to the system
            </h2>
          </Reveal>
          <Reveal y={12} delay={0.14}>
            <p className="mt-6 text-[1.02rem] leading-relaxed text-white/55">
              Controls are grouped so the right depth of security fits each kind
              of project — from a standard website to a confidential private-AI
              deployment.
            </p>
          </Reveal>
        </div>

        <div className="mt-8 sm:mt-12 grid gap-3 lg:grid-cols-2">
          {SECURITY_PACKAGES.map((pkg, i) => (
            <Reveal key={pkg.id} y={12} delay={(i % 2) * 0.06}>
              <div className="h-full border border-white/10 bg-white/[0.02] p-6 sm:p-7">
                <h3 className="display text-xl text-white">{pkg.name}</h3>
                <p className="mt-2 text-sm text-white/50">{pkg.suitedFor}</p>
                <ul className="mt-5 grid gap-2">
                  {pkg.includes.map((inc) => (
                    <li key={inc} className="flex items-start gap-2.5 text-sm text-white/65">
                      <Check size={14} className="mt-0.5 shrink-0 text-crimson-light" />
                      {inc}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 max-w-2xl text-sm text-white/40">
          Pricing is scoped per project. RSG does not publish fixed security
          pricing, and final compliance obligations depend on the client,
          industry, vendors, configuration, and legal requirements.
        </p>
      </div>
    </section>
  );
}

/* -------------------------------- FAQ ---------------------------------- */

function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 border-b border-white/[0.08]">
      <div className="container-px section-y">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Questions</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-6 text-[1.9rem] leading-tight sm:text-[2.5rem]">
              Frequently asked
            </h2>
          </Reveal>
        </div>
        <div className="mt-8 sm:mt-12 max-w-3xl">
          {SECURITY_FAQS.map((item) => (
            <details key={item.q} className="group border-t border-white/[0.08] last:border-b">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-7 [&::-webkit-details-marker]:hidden">
                <span className="display text-[1.15rem] leading-snug text-white">{item.q}</span>
                <Plus
                  size={18}
                  className="mt-1 shrink-0 text-white/40 transition-transform duration-300 group-open:rotate-45"
                />
              </summary>
              <p className="max-w-2xl pb-8 text-[0.98rem] leading-relaxed text-white/55">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- CTA ---------------------------------- */

function Cta() {
  return (
    <section id="contact" className="scroll-mt-24">
      <div className="container-px section-y">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Next step</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-6 text-[2.1rem] leading-[1.05] sm:text-[3rem]">
              Build a system that&apos;s secure from the start
            </h2>
          </Reveal>
          <Reveal y={12} delay={0.16}>
            <p className="mt-6 max-w-xl text-[1.02rem] leading-relaxed text-white/55">
              Every engagement starts with a strategy call. We review the
              business and its data first, then design the controls that fit.
            </p>
          </Reveal>
          <Reveal y={12} delay={0.22}>
            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-9">
              <Link
                href="/book"
                onClick={() => trackEvent("security_cta_click", { location: "footer", cta: "book" })}
                className="btn-primary"
              >
                Book a Strategy Call
              </Link>
              <p className="text-sm text-white/45">
                Prefer to call?{" "}
                <a
                  href={`tel:${PHONE_TEL}`}
                  className="text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
                >
                  {PHONE_DISPLAY}
                </a>
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- Control grid ---------------------------- */

export function SecurityControlGrid() {
  return (
    <div className="mt-8 sm:mt-12 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {HOMEPAGE_CONTROL_GRID.map((c) => (
        <div
          key={c}
          className="flex items-center gap-2.5 border border-white/[0.08] bg-white/[0.015] px-4 py-3 text-sm text-white/65"
        >
          <Check size={14} className="shrink-0 text-crimson-light" />
          {c}
        </div>
      ))}
    </div>
  );
}

export function SecurityPage() {
  return (
    <>
      <Hero />
      <Philosophy />
      <Pillars />
      <ApprovalFlow />
      <Framework />
      <Packages />
      <Faq />
      <Cta />
    </>
  );
}
