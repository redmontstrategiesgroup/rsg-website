"use client";

import { Reveal } from "@/components/Reveal";
import {
  SYSTEMS_WE_BUILD,
  SECURITY_CAPABILITIES,
  MODEL_OPTIONS,
  INTEGRATION_CATEGORIES,
  INDUSTRY_USE_CASES,
  PROCESS_STAGES,
  PRIVATE_AI_FAQS,
  RELATED_SERVICES,
} from "@/lib/private-ai/content";
import Link from "next/link";

export function SystemsGrid() {
  return (
    <section id="systems" className="scroll-mt-24 border-b border-white/[0.08]">
      <div className="container-px section-y">
        <Reveal y={12}>
          <p className="label">Systems RSG can build</p>
        </Reveal>
        <Reveal y={12} delay={0.06}>
          <h2 className="display mt-5 max-w-3xl text-[1.85rem] leading-tight sm:text-[2.4rem]">
            Purpose-built systems—not generic chatbots.
          </h2>
        </Reveal>
        <div className="mt-9 sm:mt-14 grid gap-4 md:grid-cols-2">
          {SYSTEMS_WE_BUILD.map((system, i) => (
            <Reveal key={system.id} y={12} delay={(i % 4) * 0.04}>
              <article className="h-full border border-white/10 bg-white/[0.02] p-6 sm:p-7">
                <h3 className="display text-xl text-white">{system.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/50">
                  {system.summary}
                </p>
                <ul className="mt-5 space-y-1.5">
                  {system.capabilities.map((c) => (
                    <li key={c} className="text-sm text-white/60">
                      <span className="mr-2 text-crimson-light">—</span>
                      {c}
                    </li>
                  ))}
                </ul>
                {system.note ? (
                  <p className="mt-5 text-xs leading-relaxed text-white/40">
                    {system.note}
                  </p>
                ) : null}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SecuritySection() {
  return (
    <section id="security" className="scroll-mt-24 border-b border-white/[0.08]">
      <div className="container-px section-y">
        <Reveal y={12}>
          <p className="label">Privacy and security architecture</p>
        </Reveal>
        <Reveal y={12} delay={0.06}>
          <h2 className="display mt-5 max-w-3xl text-[1.85rem] leading-tight sm:text-[2.4rem]">
            Your data stays under your control.
          </h2>
        </Reveal>
        <Reveal y={12} delay={0.1}>
          <p className="mt-5 max-w-3xl text-[0.98rem] leading-relaxed text-white/50">
            Private AI is not simply a chatbot with a password. RSG designs the
            complete system around how information is stored, retrieved,
            processed, logged, accessed, and deleted. Depending on the
            deployment, company data can remain on client-controlled hardware or
            inside an isolated private environment.
          </p>
        </Reveal>
        <Reveal y={12} delay={0.12}>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/40">
            RSG will not use a client&apos;s confidential information to train
            unrelated customer systems. Systems can be designed around applicable
            security and compliance requirements; final compliance depends on your
            complete environment, policies, and implementation—not on the AI
            layer alone.
          </p>
        </Reveal>
        <ul className="mt-8 sm:mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SECURITY_CAPABILITIES.map((item, i) => (
            <Reveal key={item} y={10} delay={(i % 6) * 0.03}>
              <li className="border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/65">
                {item}
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ModelOptionsSection() {
  return (
    <section className="border-b border-white/[0.08]">
      <div className="container-px section-y">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal y={12}>
              <p className="label">Custom model and AI options</p>
            </Reveal>
            <Reveal y={12} delay={0.06}>
              <h2 className="display mt-5 text-[1.85rem] leading-tight sm:text-[2.2rem]">
                Technology chosen for your constraints—not a one-size platform.
              </h2>
            </Reveal>
            <Reveal y={12} delay={0.1}>
              <p className="mt-5 text-[0.98rem] leading-relaxed text-white/50">
                Many systems use secure retrieval, workflow logic, prompt
                architecture, tools, and business integrations without training a
                model from scratch. Fine-tuning is used only when it is the right
                tool for the job.
              </p>
            </Reveal>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
            {MODEL_OPTIONS.map((item, i) => (
              <Reveal key={item} y={10} delay={(i % 4) * 0.03}>
                <li className="border border-white/10 px-4 py-3 text-sm text-white/65">
                  {item}
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function IntegrationsSection() {
  return (
    <section className="border-b border-white/[0.08]">
      <div className="container-px section-y">
        <Reveal y={12}>
          <p className="label">Integration capabilities</p>
        </Reveal>
        <Reveal y={12} delay={0.06}>
          <h2 className="display mt-5 max-w-3xl text-[1.85rem] leading-tight sm:text-[2.4rem]">
            Connect to the systems you already run.
          </h2>
        </Reveal>
        <Reveal y={12} delay={0.1}>
          <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-white/50">
            Private AI systems connect only to tools you approve. Integrations are
            scoped with API permissions, credentials management, and auditability.
          </p>
        </Reveal>
        <ul className="mt-10 flex flex-wrap gap-2">
          {INTEGRATION_CATEGORIES.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-white/10 bg-white/[0.025] px-3.5 py-2 text-sm text-white/60"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function IndustryUseCases() {
  return (
    <section className="border-b border-white/[0.08]">
      <div className="container-px section-y">
        <Reveal y={12}>
          <p className="label">Industry use cases</p>
        </Reveal>
        <Reveal y={12} delay={0.06}>
          <h2 className="display mt-5 max-w-3xl text-[1.85rem] leading-tight sm:text-[2.4rem]">
            Realistic applications across operations-heavy businesses.
          </h2>
        </Reveal>
        <Reveal y={12} delay={0.1}>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/40">
            Systems involving protected or regulated information require a
            dedicated security, legal, infrastructure, and compliance review.
          </p>
        </Reveal>
        <div className="mt-8 sm:mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {INDUSTRY_USE_CASES.map((industry, i) => (
            <Reveal key={industry.name} y={12} delay={(i % 3) * 0.04}>
              <article className="h-full border border-white/10 bg-white/[0.02] p-5">
                <h3 className="font-medium text-white">{industry.name}</h3>
                <ul className="mt-4 space-y-1.5">
                  {industry.examples.map((ex) => (
                    <li key={ex} className="text-sm text-white/55">
                      <span className="mr-2 text-crimson-light">—</span>
                      {ex}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProcessSection() {
  return (
    <section id="process" className="scroll-mt-24 border-b border-white/[0.08]">
      <div className="container-px section-y">
        <Reveal y={12}>
          <p className="label">Development process</p>
        </Reveal>
        <Reveal y={12} delay={0.06}>
          <h2 className="display mt-5 max-w-3xl text-[1.85rem] leading-tight sm:text-[2.4rem]">
            More than choosing a model.
          </h2>
        </Reveal>
        <Reveal y={12} delay={0.1}>
          <p className="mt-4 max-w-3xl text-[0.98rem] leading-relaxed text-white/50">
            Private AI development includes infrastructure, permissions, data
            pipelines, business logic, monitoring, interfaces, integrations, and
            human approval procedures.
          </p>
        </Reveal>
        <ol className="mt-8 sm:mt-12 grid gap-3 md:grid-cols-2">
          {PROCESS_STAGES.map((stage, i) => (
            <Reveal key={stage.step} y={10} delay={(i % 4) * 0.03}>
              <li className="flex gap-4 border border-white/10 bg-white/[0.02] p-5">
                <span className="font-mono text-sm text-crimson-light">
                  {String(stage.step).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-medium text-white">{stage.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">
                    {stage.body}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function PrivateAiFaq() {
  return (
    <section id="faq" className="scroll-mt-24 border-b border-white/[0.08]">
      <div className="container-px section-y">
        <Reveal y={12}>
          <p className="label">Frequently asked questions</p>
        </Reveal>
        <Reveal y={12} delay={0.06}>
          <h2 className="display mt-5 max-w-3xl text-[1.85rem] leading-tight sm:text-[2.4rem]">
            Straight answers on privacy, infrastructure, and fit.
          </h2>
        </Reveal>
        <div className="mt-8 sm:mt-12 max-w-3xl divide-y divide-white/10 border-y border-white/10">
          {PRIVATE_AI_FAQS.map((faq) => (
            <details key={faq.q} className="group py-5">
              <summary className="cursor-pointer list-none text-[1.02rem] font-medium text-white marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-4">
                  {faq.q}
                  <span className="mt-1 shrink-0 text-white/40 transition-transform group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-white/50">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PrivateAiCta() {
  return (
    <section className="border-b border-white/[0.08]">
      <div className="container-px section-y">
        <Reveal y={12}>
          <p className="label">Next step</p>
        </Reveal>
        <Reveal y={12} delay={0.06}>
          <h2 className="display mt-5 max-w-3xl text-[1.85rem] leading-tight sm:text-[2.4rem]">
            Ready to design a system around your workflows and data?
          </h2>
        </Reveal>
        <Reveal y={12} delay={0.1}>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/book?service=custom-private-ai"
              className="btn-primary px-6 py-3.5"
            >
              Design My AI System
            </Link>
            <Link href="/book?service=explore-ai" className="btn-ghost px-6 py-3.5">
              Request a Technical Consultation
            </Link>
          </div>
        </Reveal>
        <Reveal y={12} delay={0.14}>
          <div className="mt-9 sm:mt-14">
            <p className="font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-white/35">
              Related services
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
              {RELATED_SERVICES.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/55 transition-colors hover:text-crimson-light"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
