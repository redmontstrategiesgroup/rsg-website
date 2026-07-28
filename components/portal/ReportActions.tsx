"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

/** Print/download controls for the portal report view. Hidden in print. */
export function ReportActions() {
  return (
    <div className="report-actions flex flex-wrap items-center gap-4 print:hidden">
      <Link
        href="/portal"
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm text-white/75 transition-colors hover:border-white/30 hover:text-white"
      >
        <ArrowLeft size={15} />
        Back to portal
      </Link>
      <button
        onClick={() => window.print()}
        className="btn-primary inline-flex items-center gap-2 text-sm"
      >
        <Printer size={15} />
        Download PDF
      </button>
      <p className="text-[0.72rem] text-white/40">
        Choose &ldquo;Save as PDF&rdquo; in the print dialog.
      </p>
    </div>
  );
}
