"use client";

import { useState } from "react";
import { Plus, Boxes, Sparkles } from "lucide-react";
import type { VendorRecord } from "@/lib/security-center/types";
import { AGREEMENT_STATUS_LABELS } from "@/lib/security-center/catalog";
import {
  formatDay,
  inputClass,
  labelClass,
  riskPill,
  type RunFn,
} from "@/components/admin/security/shared";

const AGREEMENT_STATUSES = Object.keys(AGREEMENT_STATUS_LABELS);
const RISK_LEVELS = ["low", "medium", "high"] as const;
const STATUSES = ["active", "under_review", "offboarding", "removed"] as const;

const emptyVendor = (): Partial<VendorRecord> => ({
  name: "",
  service: "",
  purpose: "",
  dataCategories: [],
  environment: "production",
  agreementStatus: "not_documented",
  riskLevel: "medium",
  status: "active",
});

export function VendorsView({
  vendors,
  canManage,
  run,
  busy,
}: {
  vendors: VendorRecord[];
  canManage: boolean;
  run: RunFn;
  busy: boolean;
}) {
  const [editing, setEditing] = useState<Partial<VendorRecord> | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className={labelClass}>Vendor & subprocessor registry</p>
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            Every third-party service in a project — hosting, databases, email,
            SMS, payments, analytics, AI models, storage, auth — with what data
            it handles, its agreement status, and a removal procedure. RSG does
            not claim any vendor is approved for a regulated industry.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => run({ action: "seed_platform_vendors" })}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3.5 py-2 text-sm text-white/70 transition-colors hover:border-white/30 disabled:opacity-50"
            >
              <Sparkles size={14} /> Add this platform&apos;s vendors
            </button>
            <button
              onClick={() => setEditing(emptyVendor())}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3.5 py-2 text-sm text-white/70 transition-colors hover:border-white/30"
            >
              <Plus size={14} /> New vendor
            </button>
          </div>
        )}
      </div>

      {vendors.length === 0 ? (
        <div className="card flex items-start gap-3 p-6 text-sm text-white/55">
          <Boxes size={18} className="mt-0.5 shrink-0 text-white/40" />
          <p>
            No vendors documented yet.{" "}
            {canManage && "Use “Add this platform’s vendors” to record the real services this system runs on."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Agreement</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Reviewed</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="border-b border-white/[0.06] last:border-0 align-top">
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-white">{v.name}</p>
                    <p className="text-xs text-white/40">{v.service}</p>
                  </td>
                  <td className="max-w-[220px] px-4 py-3.5 text-white/55">{v.purpose}</td>
                  <td className="max-w-[180px] px-4 py-3.5 text-xs text-white/50">
                    {v.dataCategories.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3.5 text-white/60">{AGREEMENT_STATUS_LABELS[v.agreementStatus]}</td>
                  <td className="px-4 py-3.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[0.6rem] ${riskPill(v.riskLevel)}`}>
                      {v.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-white/45">{formatDay(v.lastReviewDate)}</td>
                  <td className="px-4 py-3.5 text-right">
                    {canManage && (
                      <button onClick={() => setEditing(v)} className="text-xs text-crimson-light hover:underline">
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && canManage && (
        <VendorForm
          vendor={editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSubmit={async (payload) => {
            const ok = await run({ action: "upsert_vendor", ...payload });
            if (ok) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function VendorForm({
  vendor,
  busy,
  onSubmit,
  onCancel,
}: {
  vendor: Partial<VendorRecord>;
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<Partial<VendorRecord>>({ ...vendor });
  const set = (k: keyof VendorRecord, val: unknown) => setV((prev) => ({ ...prev, [k]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-2xl border border-white/12 bg-base-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className={labelClass}>{vendor.id ? "Edit vendor" : "New vendor"}</p>
        <div className="mt-4 space-y-3">
          <input value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Vendor name" className={inputClass} />
          <input value={v.service ?? ""} onChange={(e) => set("service", e.target.value)} placeholder="Service (e.g. Managed database)" className={inputClass} />
          <textarea value={v.purpose ?? ""} onChange={(e) => set("purpose", e.target.value)} placeholder="Business purpose" rows={2} className={inputClass} />
          <input
            value={(v.dataCategories ?? []).join(", ")}
            onChange={(e) => set("dataCategories", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            placeholder="Data categories (comma-separated)"
            className={inputClass}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={v.environment ?? ""} onChange={(e) => set("environment", e.target.value)} placeholder="Environment" className={inputClass} />
            <input value={v.hostingRegion ?? ""} onChange={(e) => set("hostingRegion", e.target.value)} placeholder="Hosting region (if known)" className={inputClass} />
            <input value={v.contractOwner ?? ""} onChange={(e) => set("contractOwner", e.target.value)} placeholder="Contract owner" className={inputClass} />
            <input value={v.securityDocsUrl ?? ""} onChange={(e) => set("securityDocsUrl", e.target.value)} placeholder="Security docs URL" className={inputClass} />
            <select value={v.agreementStatus ?? "not_documented"} onChange={(e) => set("agreementStatus", e.target.value)} className={inputClass}>
              {AGREEMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  Agreement: {AGREEMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <select value={v.riskLevel ?? "medium"} onChange={(e) => set("riskLevel", e.target.value)} className={inputClass}>
              {RISK_LEVELS.map((r) => (
                <option key={r} value={r}>
                  Risk: {r}
                </option>
              ))}
            </select>
            <input type="date" value={v.renewalDate ?? ""} onChange={(e) => set("renewalDate", e.target.value)} className={inputClass} aria-label="Renewal date" />
            <input type="date" value={v.lastReviewDate ?? ""} onChange={(e) => set("lastReviewDate", e.target.value)} className={inputClass} aria-label="Last review date" />
            <select value={v.status ?? "active"} onChange={(e) => set("status", e.target.value)} className={inputClass}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  Status: {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <input value={v.accessLevel ?? ""} onChange={(e) => set("accessLevel", e.target.value)} placeholder="Access level" className={inputClass} />
          </div>
          <textarea value={v.subprocessors ?? ""} onChange={(e) => set("subprocessors", e.target.value)} placeholder="Subprocessors" rows={2} className={inputClass} />
          <textarea value={v.removalProcedure ?? ""} onChange={(e) => set("removalProcedure", e.target.value)} placeholder="Replacement / removal procedure" rows={2} className={inputClass} />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => v.name?.trim() && onSubmit(v as Record<string, unknown>)}
            disabled={busy || !v.name?.trim()}
            className="btn-primary !px-5 !py-2.5 text-sm disabled:opacity-50"
          >
            Save vendor
          </button>
          <button onClick={onCancel} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/60 hover:border-white/30">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
