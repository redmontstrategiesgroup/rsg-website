import Link from "next/link";
import { defaultConnectSettings } from "@/lib/connect-defaults";
import { PHONE_DISPLAY, PHONE_TEL } from "@/lib/site";

const connectSocial = defaultConnectSettings();

const SOCIAL_LINKS = [
  connectSocial.socialLinkedin
    ? { label: "LinkedIn", href: connectSocial.socialLinkedin }
    : null,
  connectSocial.socialInstagram
    ? { label: "Instagram", href: connectSocial.socialInstagram }
    : null,
  {
    label: "Email",
    href: `mailto:${connectSocial.socialEmail || "contact@redmontstrategiesgroup.com"}`,
  },
].filter(Boolean) as { label: string; href: string }[];

const SERVICE_LINKS = [
  {
    label: "Business Systems Audit",
    href: "/systemsaudit",
  },
  { label: "Managed Services", href: "/managedservices" },
  {
    label: "Business Consulting",
    href: "/businessconsulting",
  },
  {
    label: "AI Strategy & Implementation",
    href: "/aistrategy",
  },
  { label: "AI Automation", href: "/aiautomation" },
  {
    label: "Custom Private AI Systems",
    href: "/services/customprivateaisystems",
  },
  {
    label: "Secure Systems Standard",
    href: "/security",
  },
  {
    label: "Operations Consulting",
    href: "/operationsconsulting",
  },
  {
    label: "Web Development",
    href: "/webdevelopment",
  },
  {
    label: "CRM & Pipeline Systems",
    href: "/crmsystems",
  },
];

const INDUSTRY_LINKS = [
  {
    label: "Home Services & Trades",
    href: "/industries/homeservices",
  },
  {
    label: "Dental & Specialty Healthcare",
    href: "/industries/dentalpractices",
  },
  {
    label: "Retail & Multi-Location",
    href: "/industries/retail",
  },
  {
    label: "Additional Industries",
    href: "/industries/additional",
  },
];

const COMPANY_LINKS = [
  { label: "Services", href: "/services" },
  { label: "Managed Services", href: "/managedservices" },
  { label: "Process", href: "/process" },
  { label: "Industries", href: "/industries" },
  { label: "Security", href: "/security" },
  { label: "Demo Systems", href: "/demos" },
  { label: "Connect", href: "/connect" },
  { label: "Service Area", href: "/servicearea" },
  { label: "FAQ", href: "/faq" },
  { label: "Book", href: "/book" },
  { label: "Client Login", href: "/login" },
  { label: "Admin Portal", href: "/admin" },
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
              and the South Shore of Massachusetts. We help service and retail
              businesses fix operations, lead flow, and follow-up.
            </p>
            <a
              href={`tel:${PHONE_TEL}`}
              className="mt-8 inline-block text-sm text-white/55 transition-colors hover:text-white"
            >
              {PHONE_DISPLAY}
            </a>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
              {SOCIAL_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel={
                      link.href.startsWith("http")
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className="text-sm text-white/55 transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
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
