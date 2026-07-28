"use client";

import { useState } from "react";
import { Power, Save, FileText, Workflow, Package } from "lucide-react";
import type { SecuritySettings } from "@/lib/security-center/types";
import {
  SECURITY_PACKAGES,
  PROJECT_SECURITY_WORKFLOW,
  CLIENT_DELIVERABLES,
} from "@/lib/security-center/catalog";
import { inputClass, labelClass, type RunFn } from "@/components/admin/security/shared";

export function PoliciesView({
  settings,
  canManage,
  run,
  busy,
}: {
  settings: SecuritySettings;
  canManage: boolean;
  run: RunFn;
  busy: boolean;
}) {
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(settings.packages.map((p) => [p.id, p.startingPrice]))
  );
  const [expiry, setExpiry] = useState(settings.approvalExpiryHours);
  const [pauseReason, setPauseReason] = useState(settings.aiPausedReason);

  async function savePackages() {
    await run({
      action: "update_settings",
      packages: SECURITY_PACKAGES.map((p) => ({
        id: p.id,
        startingPrice: prices[p.id] ?? "",
      })),
      approvalExpiryHours: expiry,
    });
  }

  return (
    <div className="space-y-8">
      {/* Emergency AI control */}
      <section className="rounded-xl border border-white/12 bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Power size={18} className={settings.aiPaused ? "mt-0.5 text-crimson-light" : "mt-0.5 text-emerald-300"} />
            <div>
              <p className="text-sm font-medium text-white">Emergency AI control</p>
              <p className="mt-1 max-w-xl text-xs text-white/50">
                {settings.aiPaused
                  ? "AI features are paused. The site assistant is offline and visitors are directed to the contact form."
                  : "AI features are active with rate limits, approval controls, and audit logging."}
              </p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() =>
                run({
                  action: "toggle_ai_pause",
                  paused: !settings.aiPaused,
                  reason: settings.aiPaused ? "" : pauseReason,
                })
              }
              disabled={busy}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors disabled:opacity-50 ${
                settings.aiPaused
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
                  : "border-crimson/40 bg-crimson/10 text-crimson-light hover:bg-crimson/20"
              }`}
            >
              <Power size={14} />
              {settings.aiPaused ? "Resume AI features" : "Pause all AI features"}
            </button>
          )}
        </div>
        {canManage && !settings.aiPaused && (
          <input
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            placeholder="Reason (recorded in the audit log when paused)"
            className={`${inputClass} mt-3`}
          />
        )}
      </section>

      {/* AI approval expiry */}
      {canManage && (
        <section className="rounded-xl border border-white/12 bg-white/[0.02] p-5">
          <p className={labelClass}>AI approval expiry</p>
          <p className="mt-1 text-xs text-white/50">
            Unactioned high-risk AI requests expire after this many hours so
            stale drafts never sit approvable indefinitely.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={720}
              value={expiry}
              onChange={(e) => setExpiry(Number(e.target.value))}
              className={`${inputClass} max-w-[120px]`}
            />
            <span className="text-sm text-white/50">hours</span>
          </div>
        </section>
      )}

      {/* Security packages */}
      <section>
        <div className="flex items-center gap-2">
          <Package size={15} className="text-white/50" />
          <p className={labelClass}>Security packages</p>
        </div>
        <p className="mt-1 max-w-2xl text-xs text-white/45">
          Package structure shown on the website. Starting prices are optional —
          leave blank to show no price. RSG does not display fabricated pricing.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {SECURITY_PACKAGES.map((pkg) => (
            <div key={pkg.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-sm font-medium text-white">{pkg.name}</p>
              <p className="mt-1 text-xs text-white/45">{pkg.suitedFor}</p>
              <ul className="mt-3 space-y-1 text-xs text-white/55">
                {pkg.includes.slice(0, 5).map((inc) => (
                  <li key={inc} className="flex gap-2">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-crimson-light" />
                    {inc}
                  </li>
                ))}
                {pkg.includes.length > 5 && (
                  <li className="text-white/35">+{pkg.includes.length - 5} more controls</li>
                )}
              </ul>
              {canManage ? (
                <input
                  value={prices[pkg.id] ?? ""}
                  onChange={(e) => setPrices((p) => ({ ...p, [pkg.id]: e.target.value }))}
                  placeholder='Starting price (e.g. "Starting at $1,800") — optional'
                  className={`${inputClass} mt-3`}
                />
              ) : (
                <p className="mt-3 text-xs text-white/50">
                  {prices[pkg.id] || "No price displayed"}
                </p>
              )}
            </div>
          ))}
        </div>
        {canManage && (
          <button
            onClick={savePackages}
            disabled={busy}
            className="btn-primary mt-4 !px-5 !py-2.5 text-sm disabled:opacity-50"
          >
            <Save size={14} /> Save packages & settings
          </button>
        )}
      </section>

      {/* Internal project workflow */}
      <section>
        <div className="flex items-center gap-2">
          <Workflow size={15} className="text-white/50" />
          <p className={labelClass}>Internal project security workflow</p>
        </div>
        <p className="mt-1 text-xs text-white/45">
          Every RSG project follows this repeatable sequence, with sign-off
          required before production deployment.
        </p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {PROJECT_SECURITY_WORKFLOW.map((s) => (
            <li key={s.step} className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <span className="font-mono text-xs text-crimson-light">
                {String(s.step).padStart(2, "0")}
              </span>
              <div>
                <p className="text-sm text-white/80">{s.name}</p>
                <p className="text-xs text-white/40">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Client deliverables */}
      <section>
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-white/50" />
          <p className={labelClass}>Client security deliverables</p>
        </div>
        <p className="mt-1 text-xs text-white/45">
          Generated where included in the selected package.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CLIENT_DELIVERABLES.map((d) => (
            <div key={d} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-white/65">
              {d}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
