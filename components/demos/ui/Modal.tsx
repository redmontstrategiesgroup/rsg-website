"use client";

import type { ReactNode } from "react";
import { Dialog } from "@/components/ui/Dialog";

/**
 * Demo OS dialog. A thin wrapper over the shared <Dialog> so every caller
 * inherits body-scroll lock, focus trap, Escape/backdrop dismissal, the
 * dynamic-viewport height clamp and a 44px close control.
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
  return (
    <Dialog title={title} subtitle={subtitle} onClose={onClose} size={wide ? "lg" : "md"}>
      {children}
    </Dialog>
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
