"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  FolderKanban,
  Inbox,
  LifeBuoy,
  GraduationCap,
  FileText,
  Map,
  Receipt,
  Users,
  KeyRound,
  Menu,
  X,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/portal/ui";
import { IconButton } from "@/components/ui/IconButton";
import { useDialogBehaviour } from "@/components/ui/Dialog";

/**
 * Shared chrome for every client-portal page.
 *
 * Desktop (lg+): a persistent left sidebar carries the nine destinations and
 * the account footer, and the content column runs to `max-w-app` (1600px)
 * rather than the 1240px editorial column, so a dashboard uses a wide
 * display instead of reading as a narrow single-column list.
 *
 * Phones and tablets: a 56px top bar with the company name and a menu
 * button; navigation lives in a left drawer built on the shared dialog
 * behaviour (scroll lock, focus trap, Escape, backdrop tap). The previous
 * shell was a nine-item horizontal strip with the scrollbar hidden and no
 * scroll-to-active, so landing on /portal/team showed a rail that started
 * at Overview with no hint the current page was even in it.
 */

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/portal", label: "Overview", icon: Activity },
  { href: "/portal/project", label: "Project", icon: FolderKanban },
  { href: "/portal/workspace", label: "Requests & Files", icon: Inbox },
  { href: "/portal/support", label: "Support", icon: LifeBuoy },
  { href: "/portal/training", label: "Training", icon: GraduationCap },
  { href: "/portal/reports", label: "Reports", icon: FileText },
  { href: "/portal/roadmap", label: "Roadmap", icon: Map },
  { href: "/portal/billing", label: "Billing", icon: Receipt },
  { href: "/portal/team", label: "Team", icon: Users },
  ...(process.env.NEXT_PUBLIC_API_PLATFORM_ENABLED === "true"
    ? [{ href: "/portal/developers", label: "Developers", icon: KeyRound }]
    : []),
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
  const [drawer, setDrawer] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);

  // Route change closes the drawer.
  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  const visibleNav = NAV.filter((item) => {
    if (
      (item.href === "/portal/billing" || item.href === "/portal/team" || item.href === "/portal/developers") &&
      role === "member"
    ) {
      return false;
    }
    return true;
  });

  const isActive = (href: string) =>
    href === "/portal" ? pathname === "/portal" : !!pathname?.startsWith(href);

  const navList = (dense: boolean) => (
    <ul className="space-y-0.5">
      {visibleNav.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60 ${
                dense ? "py-2" : "py-2.5"
              } ${
                active
                  ? "bg-white/[0.06] text-white"
                  : "text-white/55 hover:bg-white/[0.03] hover:text-white/85"
              }`}
            >
              <Icon
                size={16}
                aria-hidden
                className={active ? "text-crimson-light" : "text-white/35"}
              />
              <span className="min-w-0 truncate">{item.label}</span>
              {active && (
                <span aria-hidden className="ml-auto h-1.5 w-1.5 rounded-full bg-crimson" />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const account = (
    <div className="flex items-center gap-3 border-t border-white/10 px-3 pt-4">
      <Avatar name={userName} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white/85">{userName}</p>
        <p className="truncate font-mono text-[0.6rem] uppercase tracking-label text-white/35">
          {company}
        </p>
      </div>
      <form action="/api/auth/logout" method="post">
        <IconButton
          type="submit"
          aria-label="Sign out"
          className="rounded-lg text-white/45 hover:bg-white/[0.04] hover:text-white"
        >
          <LogOut size={16} aria-hidden />
        </IconButton>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh bg-base">
      {/* Ambient background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-40" />
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-crimson/[0.08] blur-3xl" />
      </div>

      <div className="relative lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-white/10 lg:bg-base/60 lg:backdrop-blur-xl">
          <div className="flex h-16 items-center px-5">
            <Logo />
          </div>
          <p className="truncate px-5 pb-4 font-mono text-[0.6rem] uppercase tracking-label text-white/40">
            {company}
          </p>
          <nav aria-label="Portal" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
            {navList(true)}
          </nav>
          <div className="px-2 pb-5">{account}</div>
        </aside>

        <div className="min-w-0">
          {/* Mobile / tablet top bar */}
          <header className="sticky top-0 z-40 border-b border-white/10 bg-base/70 backdrop-blur-xl lg:hidden">
            <div className="flex h-14 items-center justify-between gap-3 pl-4 pr-1">
              <div className="flex min-w-0 items-center gap-3">
                <Logo />
                <span className="h-5 w-px shrink-0 bg-white/15" />
                <p className="truncate font-mono text-[0.6rem] uppercase tracking-label text-white/40">
                  {company}
                </p>
              </div>
              <IconButton
                onClick={() => setDrawer(true)}
                aria-label="Open navigation"
                aria-expanded={drawer}
                aria-controls="portal-drawer"
                className="rounded-lg text-white/70 hover:text-white"
              >
                <Menu size={20} aria-hidden />
              </IconButton>
            </div>
          </header>

          {drawer && (
            <Drawer id="portal-drawer" onClose={closeDrawer} company={company}>
              <nav aria-label="Portal" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
                {navList(false)}
              </nav>
              <div className="px-2 pb-safe">{account}</div>
            </Drawer>
          )}

          <main className="mx-auto w-full max-w-app px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

/** Left-anchored navigation sheet for narrow viewports. */
function Drawer({
  id,
  onClose,
  company,
  children,
}: {
  id: string;
  onClose: () => void;
  company: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehaviour(panelRef, onClose);

  return (
    <div
      className="dialog-backdrop fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id={id}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Portal navigation"
        tabIndex={-1}
        className="dialog-panel flex h-dvh w-[min(20rem,85vw)] flex-col border-r border-white/10 bg-base-900 outline-none"
      >
        <div className="flex h-14 items-center justify-between gap-3 pl-4 pr-1">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <span className="h-5 w-px shrink-0 bg-white/15" />
            <p className="truncate font-mono text-[0.6rem] uppercase tracking-label text-white/40">
              {company}
            </p>
          </div>
          <IconButton onClick={onClose} aria-label="Close navigation" className="rounded-lg text-white/60 hover:text-white">
            <X size={18} aria-hidden />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
