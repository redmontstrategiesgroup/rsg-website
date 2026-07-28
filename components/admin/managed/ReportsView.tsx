"use client";

import { useState } from "react";
import { Loader2, Plus, Save, Send } from "lucide-react";
import type {
  ReportKind,
  ServiceReport,
  ServiceReportData,
} from "@/lib/managed-services/types";
import {
  EmptyState,
  Field,
  type MinimalClient,
  type RunFn,
  StatusPill,
  arrayToLines,
  clientLabel,
  fmtDate,
  inputClass,
  labelClass,
  linesToArray,
} from "./shared";

const REPORT_KINDS: ReportKind[] = ["monthly", "health", "baseline", "quarterly"];

type ReportDraft = {
  id?: string;
  clientId: string;
  kind: ReportKind;
  title: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  systemsMonitored: string;
  changesCompleted: string;
  recommendations: string;
  upcomingPriorities: string;
  additionalOpportunities: string;
  uptimePct: string;
  backupsCompleted: string;
  updatesInstalled: string;
  issuesResolved: string;
  securityEvents: string;
  performanceNotes: string;
  automationActivity: string;
  aiActivity: string;
  leadMetricsText: string;
};

const EMPTY_DRAFT: ReportDraft = {
  clientId: "",
  kind: "monthly",
  title: "",
  periodStart: "",
  periodEnd: "",
  summary: "",
  systemsMonitored: "",
  changesCompleted: "",
  recommendations: "",
  upcomingPriorities: "",
  additionalOpportunities: "",
  uptimePct: "",
  backupsCompleted: "",
  updatesInstalled: "",
  issuesResolved: "",
  securityEvents: "",
  performanceNotes: "",
  automationActivity: "",
  aiActivity: "",
  leadMetricsText: "",
};

function draftFromReport(r: ServiceReport): ReportDraft {
  const d = r.data ?? {};
  return {
    id: r.id,
    clientId: r.clientId,
    kind: r.kind,
    title: r.title,
    periodStart: r.periodStart?.slice(0, 10) ?? "",
    periodEnd: r.periodEnd?.slice(0, 10) ?? "",
    summary: r.summary,
    systemsMonitored: arrayToLines(d.systemsMonitored),
    changesCompleted: arrayToLines(d.changesCompleted),
    recommendations: arrayToLines(d.recommendations),
    upcomingPriorities: arrayToLines(d.upcomingPriorities),
    additionalOpportunities: arrayToLines(d.additionalOpportunities),
    uptimePct: d.uptimePct == null ? "" : String(d.uptimePct),
    backupsCompleted: d.backupsCompleted == null ? "" : String(d.backupsCompleted),
    updatesInstalled: d.updatesInstalled == null ? "" : String(d.updatesInstalled),
    issuesResolved: d.issuesResolved == null ? "" : String(d.issuesResolved),
    securityEvents: d.securityEvents ?? "",
    performanceNotes: d.performanceNotes ?? "",
    automationActivity: d.automationActivity ?? "",
    aiActivity: d.aiActivity ?? "",
    leadMetricsText: (d.leadMetrics ?? [])
      .map((m) => `${m.label} | ${m.value}`)
      .join("\n"),
  };
}

function parseLeadMetrics(text: string): { label: string; value: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((line) => {
      const [label, ...rest] = line.split("|");
      return {
        label: (label ?? "").trim().slice(0, 200),
        value: rest.join("|").trim().slice(0, 200),
      };
    })
    .filter((m) => m.label);
}

export function ReportsView({
  reports,
  clients,
  run,
  busy,
}: {
  reports: ServiceReport[];
  clients: MinimalClient[];
  run: RunFn;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<ReportDraft | null>(null);

  const set = <K extends keyof ReportDraft>(k: K, v: ReportDraft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  async function save(status: "draft" | "published") {
    if (!draft || !draft.clientId || !draft.title.trim()) return;
    const numOrUndef = (v: string) =>
      v.trim() === "" ? undefined : Number(v) || 0;
    const strOrUndef = (v: string) => (v.trim() === "" ? undefined : v);

    const data: ServiceReportData = {
      systemsMonitored: linesToArray(draft.systemsMonitored),
      changesCompleted: linesToArray(draft.changesCompleted),
      recommendations: linesToArray(draft.recommendations),
      upcomingPriorities: linesToArray(draft.upcomingPriorities),
      additionalOpportunities: linesToArray(draft.additionalOpportunities),
      uptimePct: numOrUndef(draft.uptimePct),
      backupsCompleted: numOrUndef(draft.backupsCompleted),
      updatesInstalled: numOrUndef(draft.updatesInstalled),
      issuesResolved: numOrUndef(draft.issuesResolved),
      securityEvents: strOrUndef(draft.securityEvents),
      performanceNotes: strOrUndef(draft.performanceNotes),
      automationActivity: strOrUndef(draft.automationActivity),
      aiActivity: strOrUndef(draft.aiActivity),
      leadMetrics: parseLeadMetrics(draft.leadMetricsText),
    };

    const res = await run("upsert_report", {
      id: draft.id,
      clientId: draft.clientId,
      kind: draft.kind,
      title: draft.title.trim(),
      periodStart: draft.periodStart || null,
      periodEnd: draft.periodEnd || null,
      summary: draft.summary,
      status,
      data,
    });
    if (res && !draft.id) {
      const saved = res.report as ServiceReport | undefined;
      if (saved?.id) setDraft((d) => (d ? { ...d, id: saved.id } : d));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/45">
          Service reports
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:text-white"
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
        >
          <Plus size={13} /> New report
        </button>
      </div>

      {reports.length ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 font-normal">Client</th>
                <th className="px-4 py-3 font-normal">Kind</th>
                <th className="px-4 py-3 font-normal">Title</th>
                <th className="px-4 py-3 font-normal">Period</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal">Published</th>
                <th className="px-4 py-3 font-normal" />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-white/5 last:border-0 ${
                    draft?.id === r.id ? "bg-crimson/[0.06]" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-white/80">
                    {clientLabel(clients, r.clientId)}
                  </td>
                  <td className="px-4 py-3 text-white/60">{r.kind}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-white/85">
                    {r.title}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill value={r.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {fmtDate(r.publishedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-xs text-crimson-light hover:underline"
                      onClick={() => setDraft(draftFromReport(r))}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No reports yet."
          hint="Build a baseline or monthly report and publish it to the client portal."
        />
      )}

      {draft ? (
        <div className="space-y-6 rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/45">
              {draft.id ? "Edit report" : "New report"}
            </p>
            <button
              type="button"
              className="text-xs text-white/45 hover:text-white"
              onClick={() => setDraft(null)}
            >
              Close builder
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Client *">
              <select
                className={inputClass}
                value={draft.clientId}
                onChange={(e) => set("clientId", e.target.value)}
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company || c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kind">
              <select
                className={inputClass}
                value={draft.kind}
                onChange={(e) => set("kind", e.target.value as ReportKind)}
              >
                {REPORT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Period start">
              <input
                type="date"
                className={inputClass}
                value={draft.periodStart}
                onChange={(e) => set("periodStart", e.target.value)}
              />
            </Field>
            <Field label="Period end">
              <input
                type="date"
                className={inputClass}
                value={draft.periodEnd}
                onChange={(e) => set("periodEnd", e.target.value)}
              />
            </Field>
            <Field label="Title *" className="sm:col-span-2 lg:col-span-4">
              <input
                className={inputClass}
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="July 2026 system health report"
              />
            </Field>
          </div>

          <Field label="Summary">
            <textarea
              rows={3}
              className={inputClass}
              value={draft.summary}
              onChange={(e) => set("summary", e.target.value)}
            />
          </Field>

          <div>
            <p className={labelClass}>Metrics</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Uptime %">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className={inputClass}
                  value={draft.uptimePct}
                  onChange={(e) => set("uptimePct", e.target.value)}
                />
              </Field>
              <Field label="Backups completed">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={draft.backupsCompleted}
                  onChange={(e) => set("backupsCompleted", e.target.value)}
                />
              </Field>
              <Field label="Updates installed">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={draft.updatesInstalled}
                  onChange={(e) => set("updatesInstalled", e.target.value)}
                />
              </Field>
              <Field label="Issues resolved">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={draft.issuesResolved}
                  onChange={(e) => set("issuesResolved", e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Systems monitored (one per line)">
              <textarea
                rows={4}
                className={`${inputClass} font-mono text-xs`}
                value={draft.systemsMonitored}
                onChange={(e) => set("systemsMonitored", e.target.value)}
              />
            </Field>
            <Field label="Changes completed (one per line)">
              <textarea
                rows={4}
                className={`${inputClass} font-mono text-xs`}
                value={draft.changesCompleted}
                onChange={(e) => set("changesCompleted", e.target.value)}
              />
            </Field>
            <Field label="Recommendations (one per line)">
              <textarea
                rows={4}
                className={`${inputClass} font-mono text-xs`}
                value={draft.recommendations}
                onChange={(e) => set("recommendations", e.target.value)}
              />
            </Field>
            <Field label="Upcoming priorities (one per line)">
              <textarea
                rows={4}
                className={`${inputClass} font-mono text-xs`}
                value={draft.upcomingPriorities}
                onChange={(e) => set("upcomingPriorities", e.target.value)}
              />
            </Field>
            <Field label="Additional opportunities (one per line)">
              <textarea
                rows={4}
                className={`${inputClass} font-mono text-xs`}
                value={draft.additionalOpportunities}
                onChange={(e) => set("additionalOpportunities", e.target.value)}
              />
            </Field>
            <Field label={'Lead metrics ("Label | Value", one per line)'}>
              <textarea
                rows={4}
                className={`${inputClass} font-mono text-xs`}
                value={draft.leadMetricsText}
                onChange={(e) => set("leadMetricsText", e.target.value)}
                placeholder={"New leads | 42\nBooked calls | 9"}
              />
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Security events">
              <textarea
                rows={2}
                className={inputClass}
                value={draft.securityEvents}
                onChange={(e) => set("securityEvents", e.target.value)}
              />
            </Field>
            <Field label="Performance notes">
              <textarea
                rows={2}
                className={inputClass}
                value={draft.performanceNotes}
                onChange={(e) => set("performanceNotes", e.target.value)}
              />
            </Field>
            <Field label="Automation activity">
              <textarea
                rows={2}
                className={inputClass}
                value={draft.automationActivity}
                onChange={(e) => set("automationActivity", e.target.value)}
              />
            </Field>
            <Field label="AI activity">
              <textarea
                rows={2}
                className={inputClass}
                value={draft.aiActivity}
                onChange={(e) => set("aiActivity", e.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => save("draft")}
              disabled={busy || !draft.clientId || !draft.title.trim()}
              className="btn-ghost gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save draft
            </button>
            <button
              type="button"
              onClick={() => save("published")}
              disabled={busy || !draft.clientId || !draft.title.trim()}
              className="btn-primary gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              Publish to client portal
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
