"use client";

import Link from "next/link";
import { Reveal } from "../Reveal";
import { trackEvent } from "@/lib/events";

export function Hero() {
  return (
    <section className="relative">
      {/*
        Mobile hero is deliberately compact: pt-28 clears the 64px fixed nav
        with room to breathe rather than the 160px it used to reserve, so the
        headline, the promise, and the one CTA all land above the fold on a
        small phone instead of the CTA sitting a scroll away.
      */}
      <div className="container-px grid items-center gap-16 pb-16 pt-28 sm:pb-28 sm:pt-52 lg:grid-cols-12 lg:gap-8 lg:pb-36">
        <div className="lg:col-span-7">
          <Reveal y={12}>
            <h1 className="display text-[2.35rem] leading-[1.02] sm:text-[4.4rem] sm:leading-[0.99] lg:text-[5.2rem]">
              Business Consulting
              <br />
              <span className="text-white/40">for Service Businesses</span>
            </h1>
          </Reveal>
          <Reveal y={12} delay={0.1}>
            <p className="mt-5 max-w-xl text-[1.02rem] leading-relaxed text-white/55 sm:mt-8 sm:text-lg">
              Redmont Strategies Group helps service businesses fix lead flow,
              follow-up, and operations — then builds the systems to run them.
            </p>
          </Reveal>
          <Reveal y={12} delay={0.18}>
            <div className="mt-8 sm:mt-12">
              <Link
                href="/book"
                onClick={() => trackEvent("book_strategy_call_click", { location: "hero" })}
                className="btn-primary w-full sm:w-auto"
              >
                Book a Strategy Call
              </Link>
            </div>
          </Reveal>
        </div>

        {/*
          Desktop-only diagram. The fade-in is CSS (animate-fade-up) rather
          than framer-motion — that removed the library from the marketing
          critical path entirely, and it is never downloaded on a phone where
          this element does not render at all.
        */}
        <div className="hidden lg:col-span-5 lg:block lg:animate-fade-up lg:[animation-delay:0.3s] lg:[animation-fill-mode:backwards]">
          <SystemsModel />
        </div>
      </div>
    </section>
  );
}

const MID_NODES = [
  { label: "Operations", x: 120, y: 176, side: "left" },
  { label: "Sales", x: 440, y: 176, side: "right" },
  { label: "Marketing", x: 120, y: 268, side: "left" },
  { label: "Follow-Up", x: 440, y: 268, side: "right" },
] as const;

const BASE_CELLS = ["Web Infrastructure", "AI Implementation", "Reporting"];

export function SystemsModel() {
  return (
    <svg
      viewBox="0 0 560 520"
      className="h-auto w-full"
      role="img"
      aria-label="Structural model of a business: strategy at the top, operations, sales, marketing, and customer follow-up along one spine, resting on an execution layer of web infrastructure, AI implementation, and reporting."
    >
      {/* Direction band */}
      <rect
        x={60}
        y={36}
        width={440}
        height={62}
        fill="none"
        stroke="rgba(255,255,255,0.16)"
      />
      <text
        x={280}
        y={71}
        textAnchor="middle"
        className="font-mono"
        fontSize="11"
        letterSpacing="0.22em"
        fill="rgba(255,255,255,0.75)"
      >
        STRATEGY
      </text>

      {/* Spine: the through-line from direction to execution */}
      <line
        x1={280}
        y1={98}
        x2={280}
        y2={388}
        stroke="rgba(179,36,58,0.6)"
        strokeWidth="1.25"
        className="flow-line"
      />
      <circle
        cx={280}
        cy={98}
        r={3}
        fill="none"
        stroke="rgba(179,36,58,0.5)"
        className="core-pulse"
      />

      {/* Function nodes, branching off the spine */}
      {MID_NODES.map((n) => (
        <g key={n.label}>
          <line
            x1={280}
            y1={n.y}
            x2={n.x}
            y2={n.y}
            stroke="rgba(255,255,255,0.14)"
          />
          <rect
            x={n.x - 4}
            y={n.y - 4}
            width={8}
            height={8}
            transform={`rotate(45 ${n.x} ${n.y})`}
            fill="#08080b"
            stroke="rgba(255,255,255,0.5)"
          />
          <text
            x={n.side === "left" ? n.x - 16 : n.x + 16}
            y={n.y + 3.5}
            textAnchor={n.side === "left" ? "end" : "start"}
            className="font-mono"
            fontSize="10"
            letterSpacing="0.16em"
            fill="rgba(255,255,255,0.55)"
          >
            {n.label.toUpperCase()}
          </text>
        </g>
      ))}

      {/* Execution layer */}
      <rect
        x={60}
        y={388}
        width={440}
        height={72}
        fill="none"
        stroke="rgba(255,255,255,0.16)"
      />
      {[1, 2].map((i) => (
        <line
          key={i}
          x1={60 + (440 / 3) * i}
          y1={388}
          x2={60 + (440 / 3) * i}
          y2={460}
          stroke="rgba(255,255,255,0.1)"
        />
      ))}
      {BASE_CELLS.map((label, i) => (
        <text
          key={label}
          x={60 + (440 / 3) * i + 440 / 6}
          y={428}
          textAnchor="middle"
          className="font-mono"
          fontSize="8.5"
          letterSpacing="0.14em"
          fill="rgba(255,255,255,0.5)"
        >
          {label.toUpperCase()}
        </text>
      ))}

      {/* Ground line */}
      <line
        x1={60}
        y1={492}
        x2={500}
        y2={492}
        stroke="rgba(255,255,255,0.08)"
      />
    </svg>
  );
}
