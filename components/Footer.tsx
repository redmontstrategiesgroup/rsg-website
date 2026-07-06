import Link from "next/link";
import { TrackedLink } from "./TrackedLink";

const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL;

const CAPABILITIES = [
  "Business Consulting",
  "AI Strategy",
  "AI Implementation",
  "Marketing Systems",
  "Web Development",
  "Operations Consulting",
];

const COMPANY_LINKS = [
  { label: "Services", href: "/services" },
  { label: "Process", href: "/process" },
  { label: "Industries", href: "/industries" },
  { label: "Contact", href: "/contact" },
  { label: "Client Login", href: "/login" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-base">
      {/* Conversion band */}
      <div className="border-b border-white/10">
        <div className="container-px flex flex-col items-start gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="display max-w-xl text-[1.7rem] leading-[1.12] sm:text-[2.1rem]">
            Ready to find the leaks
            <br />
            <span className="text-white/40">in your business?</span>
          </h2>
          <TrackedLink
            href={BOOKING_URL ?? "/contact"}
            event="book_strategy_call_click"
            eventProps={{ location: "footer" }}
            className="btn-primary shrink-0"
          >
            Book a Strategy Call
          </TrackedLink>
        </div>
      </div>

      <div className="container-px pb-12 pt-20 sm:pt-24">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/rsg-mark.png"
              alt="Redmont Strategies Group"
              className="h-14 w-auto"
            />
            <p className="mt-8 max-w-sm text-sm leading-relaxed text-white/50">
              A business consulting and strategy firm. We help service
              businesses modernize operations, improve lead conversion, and
              implement AI with a real business purpose.
            </p>
          </div>

          <div className="lg:col-span-3">
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.24em] text-white/35">
              Capabilities
            </p>
            <ul className="mt-6 space-y-3">
              {CAPABILITIES.map((item) => (
                <li key={item}>
                  <Link
                    href="/services"
                    className="text-sm text-white/55 transition-colors hover:text-white"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.24em] text-white/35">
              Company
            </p>
            <ul className="mt-6 space-y-3">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/55 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-20 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-white/35">
            &copy; 2026 Redmont Strategies Group. All rights reserved.
          </p>
          <p className="text-[0.6rem] uppercase tracking-[0.24em] text-white/25">
            Strategy &middot; Systems &middot; Execution
          </p>
        </div>
      </div>
    </footer>
  );
}
