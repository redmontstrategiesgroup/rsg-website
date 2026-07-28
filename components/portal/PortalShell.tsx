"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/portal/ui";

/**
 * Shared chrome for the lifecycle portal pages. The classic dashboard at
 * /portal keeps its own layout; every sub-page wraps itself in this shell so
 * navigation stays consistent.
 */

const NAV: { href: string; label: string }[] = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/project", label: "Project" },
  { href: "/portal/workspace", label: "Requests & Files" },
  { href: "/portal/support", label: "Support" },
  { href: "/portal/training", label: "Training" },
  { href: "/portal/reports", label: "Reports" },
  { href: "/portal/roadmap", label: "Roadmap" },
  { href: "/portal/billing", label: "Billing" },
  { href: "/portal/team", label: "Team" },
];

export function PortalShell({
  company,
  userName,
  role,
  children,
}: {
  company: string;
  userName: string;
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const visibleNav = NAV.filter((item) => {
    if ((item.href === "/portal/billing" || item.href === "/portal/team") && role === "member") {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-base">
      {/* Ambient background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div className="bg-grid absolute inset-0 opacity-40" />
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-crimson/[0.08] blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-base/70 backdrop-blur-xl">
        <div className="container-px">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Logo />
              <span className="hidden h-5 w-px bg-white/15 sm:block" />
              <p className="hidden truncate font-mono text-[0.6rem] uppercase tracking-label text-white/40 sm:block">
                {company}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-white/45 sm:block">{userName}</span>
              <Avatar name={userName} />
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="text-xs text-white/40 transition hover:text-white"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
          <nav className="no-scrollbar -mb-px flex gap-1 overflow-x-auto" aria-label="Portal">
            {visibleNav.map((item) => {
              const active =
                item.href === "/portal"
                  ? pathname === "/portal"
                  : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative whitespace-nowrap px-3.5 py-3 text-sm transition ${
                    active ? "text-white" : "text-white/45 hover:text-white/75"
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 -bottom-px h-px bg-crimson"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="container-px relative pb-24 pt-10">{children}</main>
    </div>
  );
}
