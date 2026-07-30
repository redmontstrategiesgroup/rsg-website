"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { trackEvent } from "@/lib/events";

const MENU_ID = "mobile-nav";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Process", href: "/process" },
  { label: "Industries", href: "/industries" },
  { label: "Demos", href: "/demos" },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

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

  // Escape closes the menu and returns focus to the button that opened it,
  // so keyboard users are never stranded inside an open panel.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMobileOpen(false);
      toggleRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || mobileOpen
          ? "border-b border-white/10 bg-base/95 backdrop-blur"
          : "border-b border-transparent"
      }`}
    >
      <nav className="container-px relative flex h-16 items-center justify-between sm:h-20">
        {/* min-h-11 makes the wordmark a 44px target without resizing it. */}
        <Link
          href="/"
          aria-label="Redmont Strategies Group home"
          className="flex min-h-11 min-w-0 items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 lg:min-h-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/rsg-wordmark.png"
            alt="Redmont Strategies Group"
            className="h-9 w-auto sm:h-11"
          />
        </Link>

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-9 lg:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors ${
                  active ? "text-white" : "text-white/60 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden lg:block">
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

        {/* 44px square — the minimum comfortable touch target, up from 40. */}
        <button
          ref={toggleRef}
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-white/15 text-white transition-colors hover:border-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls={MENU_ID}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/*
        One-thumb menu: every row is a 56px-tall full-width target, the
        current page is marked with aria-current rather than colour alone,
        and the booking CTA sits last so it lands nearest the thumb.
      */}
      {mobileOpen && (
        <nav
          id={MENU_ID}
          aria-label="Main menu"
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-white/10 bg-base sm:max-h-[calc(100dvh-5rem)] lg:hidden"
        >
          <div className="container-px flex flex-col py-3">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`flex min-h-14 items-center border-b border-white/[0.06] px-1 text-[1.05rem] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                    active ? "text-white" : "text-white/70 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-14 items-center border-b border-white/[0.06] px-1 text-[1.05rem] text-white/70 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
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
              className="btn-primary mt-4 w-full"
            >
              Book a Strategy Call
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
