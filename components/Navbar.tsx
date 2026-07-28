"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { trackEvent } from "@/lib/events";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Process", href: "/process" },
  { label: "Demos", href: "/demos" },
  { label: "FAQ", href: "/faq" },
  { label: "Book", href: "/book" },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || mobileOpen
          ? "border-b border-white/10 bg-base/95 backdrop-blur"
          : "border-b border-transparent"
      }`}
    >
      <nav className="container-px relative flex h-16 items-center sm:h-20">
        <Link
          href="/"
          aria-label="Redmont Strategies Group home"
          className="relative z-10 flex min-w-0 items-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/rsg-wordmark.png"
            alt="Redmont Strategies Group"
            className="h-9 w-auto sm:h-11"
          />
        </Link>

        <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 md:flex">
          <div className="ml-[9rem] flex items-center justify-center gap-8 lg:ml-[11rem] lg:gap-9">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`pointer-events-auto text-sm transition-colors ${
                    active ? "text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
          <div className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Link
              href="/industries"
              className={`text-sm transition-colors ${
                pathname === "/industries" ? "text-white" : "text-white/60 hover:text-white"
              }`}
            >
              Industries
            </Link>
          </div>
        </div>

        <div className="ml-[2rem] hidden lg:block">
          <Link
            href="/book"
            onClick={() =>
              trackEvent("book_strategy_call_click", { location: "nav" })
            }
            className="btn-primary px-6 py-3 text-[0.82rem]"
          >
            Book a Strategy Call
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-white/15 text-white lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-white/10 bg-base sm:max-h-[calc(100dvh-5rem)] lg:hidden">
          <div className="container-px flex flex-col py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="border-b border-white/[0.06] px-1 py-4 text-base text-white/70 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="border-b border-white/[0.06] px-1 py-4 text-base text-white/70 transition-colors hover:text-white"
            >
              Client Login
            </Link>
            <Link
              href="/book"
              onClick={() => {
                setMobileOpen(false);
                trackEvent("book_strategy_call_click", {
                  location: "nav_mobile",
                });
              }}
              className="btn-primary mt-5 w-full"
            >
              Book a Strategy Call
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
