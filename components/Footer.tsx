import Link from "next/link";
import { PHONE_DISPLAY, PHONE_TEL } from "@/lib/site";

const SERVICE_LINKS = [
  {
    label: "Business Systems Audit",
    href: "/business-systems-audit-plymouth-county-ma",
  },
  {
    label: "Business Consulting",
    href: "/business-consulting-plymouth-county-ma",
  },
  {
    label: "AI Strategy & Implementation",
    href: "/ai-strategy-implementation-plymouth-county-ma",
  },
  { label: "AI Automation", href: "/ai-automation-plymouth-county-ma" },
  {
    label: "Operations Consulting",
    href: "/operations-consulting-plymouth-county-ma",
  },
  {
    label: "Web Development",
    href: "/web-development-digital-infrastructure-plymouth-county-ma",
  },
  {
    label: "CRM & Pipeline Systems",
    href: "/crm-pipeline-systems-plymouth-county-ma",
  },
];

const INDUSTRY_LINKS = [
  {
    label: "Med Spas & Aesthetic Clinics",
    href: "/med-spa-business-consulting-ai-automation",
  },
  {
    label: "Gyms & Fitness Studios",
    href: "/gym-fitness-studio-business-systems",
  },
  {
    label: "Home Service Companies",
    href: "/home-service-business-consulting-ai-automation",
  },
  {
    label: "Dental & Wellness Offices",
    href: "/dental-wellness-office-ai-strategy",
  },
  {
    label: "Contractors",
    href: "/contractor-business-systems",
  },
];

const COMPANY_LINKS = [
  { label: "Services", href: "/services" },
  { label: "Process", href: "/process" },
  { label: "Industries", href: "/industries" },
  { label: "Demo Systems", href: "/demos" },
  { label: "Connect", href: "/connect" },
  { label: "Service Area", href: "/service-area-plymouth-county-south-shore-ma" },
  { label: "FAQ", href: "/faq" },
  { label: "Book", href: "/book" },
  { label: "Client Login", href: "/login" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-base">
      <div className="container-px pb-12 pt-20 sm:pt-24">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/rsg-mark.png"
              alt="Redmont Strategies Group"
              className="h-16 w-auto"
            />
            <p className="mt-8 max-w-sm text-sm leading-relaxed text-white/50">
              A business consulting and strategy firm serving Plymouth County
              and the South Shore of Massachusetts. We help service businesses
              fix operations, lead flow, and follow-up.
            </p>
            <a
              href={`tel:${PHONE_TEL}`}
              className="mt-8 inline-block text-sm text-white/55 transition-colors hover:text-white"
            >
              {PHONE_DISPLAY}
            </a>
          </div>

          <div className="lg:col-span-3">
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.24em] text-white/35">
              Services
            </p>
            <ul className="mt-6 space-y-3">
              {SERVICE_LINKS.map((link) => (
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

          <div className="lg:col-span-3">
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.24em] text-white/35">
              Industries
            </p>
            <ul className="mt-6 space-y-3">
              {INDUSTRY_LINKS.map((link) => (
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

          <div className="lg:col-span-2">
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

        <div className="mt-20 border-t border-white/10 pt-8">
          <p className="text-xs text-white/35">
            &copy; 2026 Redmont Strategies Group. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
