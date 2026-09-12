"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

/* ------------------------------------------------------------------ */
/*  Body scroll lock                                                   */
/* ------------------------------------------------------------------ */

/**
 * Reference-counted so a dialog opened from inside another dialog does not
 * unlock the page when the inner one closes. The document scrollbar is
 * hidden site-wide (globals.css), so no gutter compensation is needed.
 */
let lockCount = 0;
let savedOverflow = "";

function lockBody() {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

function unlockBody() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = savedOverflow;
}

/**
 * Everything a modal surface needs that isn't markup: body-scroll lock,
 * Escape to close, focus moved into the panel on open and restored on close,
 * and Tab/Shift+Tab kept inside the panel. Use directly when a component
 * already owns its own markup (a drawer, a sheet); otherwise use <Dialog>.
 */
export function useDialogBehaviour(
  panelRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  open = true
) {
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    restoreRef.current = document.activeElement as HTMLElement | null;
    lockBody();

    // Prefer the first real control; fall back to the panel itself.
    const first = panel ? focusables(panel)[0] : undefined;
    (first ?? panel)?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = focusables(panel);
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstNode || active === panel)) {
        e.preventDefault();
        lastNode.focus();
      } else if (!e.shiftKey && active === lastNode) {
        e.preventDefault();
        firstNode.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBody();
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, panelRef]);
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Tabbable descendants in DOM order; excludes tabindex="-1" (honeypots, decoys). */
function focusables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (n) => !n.hasAttribute("disabled") && n.tabIndex !== -1 && n.offsetParent !== null
  );
}

/* ------------------------------------------------------------------ */
/*  Dialog                                                             */
/* ------------------------------------------------------------------ */

type Size = "sm" | "md" | "lg" | "xl" | "full";

const SIZE: Record<Size, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-[calc(100vw-3rem)]",
};

type Props = {
  /** Accessible name. Rendered as the header unless `hideHeader`. */
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  size?: Size;
  /**
   * `sheet` (default) rises from the bottom on phones and centres from `sm`
   * up; `center` always centres. Sheets are what a thumb expects.
   */
  align?: "sheet" | "center";
  /** Omit the built-in title bar; the caller renders its own. */
  hideHeader?: boolean;
  /** Extra classes on the panel (background, padding overrides). */
  panelClassName?: string;
  /** z-index class; defaults above the site chrome and chat widget. */
  zIndexClassName?: string;
  /** Slot rendered in the header's right side, before the close button. */
  headerActions?: ReactNode;
};

/**
 * The one modal. Locks the page, traps focus, closes on Escape and backdrop
 * tap, never exceeds the *dynamic* viewport (so a 430px-tall landscape phone
 * with browser chrome showing can still reach the bottom button), and keeps
 * inner scrolling from chaining to the page behind it.
 *
 * Replaces four independent implementations that each missed a different
 * subset of the above.
 */
export function Dialog({
  title,
  subtitle,
  onClose,
  children,
  size = "md",
  align = "sheet",
  hideHeader = false,
  panelClassName = "",
  zIndexClassName = "z-[70]",
  headerActions,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogBehaviour(panelRef, onClose);

  // pointerdown rather than mousedown so a touch on the backdrop dismisses
  // without waiting for the synthesized click (and its 300ms on some UAs).
  const onBackdrop = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const sheet = align === "sheet";

  return (
    <div
      className={`dialog-backdrop fixed inset-0 ${zIndexClassName} flex justify-center bg-black/70 backdrop-blur-sm ${
        sheet ? "items-end p-0 sm:items-center sm:p-6" : "items-center p-4 sm:p-6"
      }`}
      onPointerDown={onBackdrop}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`dialog-panel flex w-full flex-col overflow-hidden border border-white/12 bg-base-800 shadow-lift outline-none ${
          sheet ? "max-h-[92dvh] rounded-t-xl sm:rounded-xl" : "max-h-[calc(100dvh-2rem)] rounded-xl"
        } ${SIZE[size]} ${panelClassName}`}
      >
        {hideHeader ? (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        ) : (
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] py-2 pl-5 pr-2">
            <div className="min-w-0 py-2">
              <h2 id={titleId} className="text-sm font-medium text-white">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-xs text-white/45">{subtitle}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {headerActions}
              <IconButton
                onClick={onClose}
                aria-label="Close dialog"
                className="rounded text-white/50 hover:text-white"
              >
                <X size={16} />
              </IconButton>
            </div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
