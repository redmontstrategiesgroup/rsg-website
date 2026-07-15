"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Accessible dialog used across the demo OS: labelled, Escape/backdrop
 * dismissal, focus moved in on open and restored on close.
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border border-white/12 bg-base-800 shadow-lift outline-none sm:rounded-xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-4">
          <div>
            <h3 className="text-sm font-medium text-white">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-white/45">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 text-white/50 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
            aria-label="Close dialog"
          >
            <X size={13} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm leading-relaxed text-white/60">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-xs">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="btn-primary px-4 py-2 text-xs"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
