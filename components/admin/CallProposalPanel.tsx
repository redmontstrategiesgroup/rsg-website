"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ExternalLink, FileText, RefreshCw } from "lucide-react";
import { postJson } from "@/lib/api";
import type {
  CallBrief,
  CallBriefRecord,
  CallSummary,
  Evidence,
} from "@/lib/call-proposal/types";

// Class strings follow LeadAiPanel.tsx / the expanded-lead markup in AdminConsole.tsx.
const box = "rounded-lg border border-white/10 bg-white/2 p-3.5";
const focusRing =
  "transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-crimson-light";
const ghostBtn = `inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-white disabled:opacity-50 ${focusRing}`;
const primaryBtn = `inline-flex items-center gap-2 rounded-lg bg-crimson px-3 py-2 text-sm font-medium text-white hover:bg-crimson-light disabled:opacity-50 ${focusRing}`;

type Listing = {
  briefs: CallBriefRecord[];
  calls: CallSummary[];
  readyCalls: number;
  enabled: boolean;
};

export function proposalHref(proposalId: string): string {
  return `/admin?section=proposals&proposal=${encodeURIComponent(proposalId)}#lifecycle`;
}

async function fetchListing(leadId: string): Promise<{ listing: Listing; error?: undefined } | { listing: null; error: string }> {
  try {
    const res = await fetch(`/api/admin/leads/${leadId}/call-briefs`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { listing: null, error: body.error ?? "Could not load call briefs." };
    return { listing: body as Listing };
  } catch {
    return { listing: null, error: "Network error: could not load call briefs." };
  }
}

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function money(cents: number | null): string {
  return cents == null ? "" : `$${(cents / 100).toLocaleString("en-US")}`;
}

function Quote({ evidence, calls, recordingIds }: { evidence: Evidence; calls: CallSummary[]; recordingIds: string[] }) {
  const rec = calls.find((c) => c.id === recordingIds[evidence.call - 1]);
  return (
    <blockquote className="mt-1 border-l-2 border-white/15 pl-2.5 text-xs leading-relaxed text-white/60">
      &ldquo;{evidence.quote}&rdquo;
      <span className="ml-1 text-white/45">
        ({rec ? `${rec.title || "call"}${rec.recordedAt ? `, ${fmt(rec.recordedAt)}` : ""}` : `call ${evidence.call}`})
      </span>
    </blockquote>
  );
}

function Fact({
  children,
  evidence,
  calls,
  recordingIds,
}: {
  children: ReactNode;
  evidence: Evidence;
  calls: CallSummary[];
  recordingIds: string[];
}) {
  return (
    <li>
      <details>
        <summary className="cursor-pointer text-sm text-white/80">
          {children}
          {!evidence.verified && (
            <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[0.6875rem] text-amber-300">
              unverified
            </span>
          )}
        </summary>
        <Quote evidence={evidence} calls={calls} recordingIds={recordingIds} />
      </details>
    </li>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-white/60">{label}</p>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

/** The extracted facts, each expandable to its evidence quote. Shared with the proposal editor. */
export function BriefFacts({
  brief,
  calls,
  recordingIds,
}: {
  brief: CallBrief;
  calls: CallSummary[];
  recordingIds: string[];
}) {
  const f = { calls, recordingIds };
  return (
    <div className="space-y-3">
      {brief.summary && <p className="text-sm leading-relaxed text-white/75">{brief.summary}</p>}
      {brief.pain_points.length > 0 && (
        <Group label="Pain points">
          {brief.pain_points.map((p, i) => (
            <Fact key={i} evidence={p.evidence} {...f}>{p.text}</Fact>
          ))}
        </Group>
      )}
      {brief.current_tools.length > 0 && (
        <Group label="Current tools">
          {brief.current_tools.map((t, i) => (
            <Fact key={i} evidence={t.evidence} {...f}>
              <span className="text-white">{t.name}</span>
              {t.use ? `: ${t.use}` : ""}
              {t.issue ? ` (${t.issue})` : ""}
            </Fact>
          ))}
        </Group>
      )}
      {brief.goals.length > 0 && (
        <Group label="Goals">
          {brief.goals.map((g, i) => (
            <Fact key={i} evidence={g.evidence} {...f}>{g.text}</Fact>
          ))}
        </Group>
      )}
      <Group label="Budget">
        {brief.budget ? (
          <Fact evidence={brief.budget.evidence} {...f}>
            {brief.budget.stated}
            {brief.budget.low_cents != null || brief.budget.high_cents != null
              ? ` (${[money(brief.budget.low_cents), money(brief.budget.high_cents)].filter(Boolean).join(" to ")})`
              : ""}
            <span className="ml-1 text-xs text-white/50">{brief.budget.confidence} confidence</span>
          </Fact>
        ) : (
          <li className="text-sm text-white/50">Not discussed</li>
        )}
      </Group>
      <Group label="Timeline">
        {brief.timeline ? (
          <Fact evidence={brief.timeline.evidence} {...f}>
            {brief.timeline.stated}
            {brief.timeline.target_date ? ` (target ${brief.timeline.target_date})` : ""}
            <span className="ml-1 text-xs text-white/50">{brief.timeline.urgency} urgency</span>
          </Fact>
        ) : (
          <li className="text-sm text-white/50">Not discussed</li>
        )}
      </Group>
      {brief.decision_makers.length > 0 && (
        <Group label="Decision makers">
          {brief.decision_makers.map((d, i) => (
            <Fact key={i} evidence={d.evidence} {...f}>
              {d.name}
              {d.role ? `, ${d.role}` : ""}
            </Fact>
          ))}
        </Group>
      )}
      {brief.open_questions.length > 0 && (
        <Group label="Open questions for the next call">
          {brief.open_questions.map((q, i) => (
            <li key={i} className="text-sm text-white/75">{q}</li>
          ))}
        </Group>
      )}
    </div>
  );
}

export function CallProposalPanel({ leadId }: { leadId: string }) {
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<"draft" | "retry" | null>(null);

  const reload = useCallback(async () => {
    const r = await fetchListing(leadId);
    if (r.listing) setData(r.listing);
    else setError(r.error);
  }, [leadId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchListing(leadId);
      if (cancelled) return;
      if (r.listing) setData(r.listing);
      else setError(r.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  // A run started before this panel mounted (or by another tab) has no local request to
  // wait on, so poll until it settles. The GET also sweeps dead runs.
  const inFlight = data?.briefs[0]?.status === "extracting" || data?.briefs[0]?.status === "drafting";
  useEffect(() => {
    if (!inFlight || running !== null) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      const r = await fetchListing(leadId);
      if (!cancelled && r.listing) setData(r.listing);
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [inFlight, running, leadId]);

  async function start(kind: "draft" | "retry", url: string) {
    setRunning(kind);
    setError(null);
    try {
      const res = await postJson(url, {});
      const body = await res.json().catch(() => ({}));
      if (Array.isArray(body.briefs)) setData(body as Listing);
      if (!res.ok) setError(body.error ?? "Drafting failed.");
    } catch {
      setError("Network error: the draft may still be running. Refresh in a minute.");
      void reload();
    } finally {
      setRunning(null);
    }
  }

  const latest = data?.briefs[0] ?? null;
  const older = data?.briefs.slice(1) ?? [];
  const busy = running !== null || latest?.status === "extracting" || latest?.status === "drafting";
  const disabledReason = !data
    ? null
    : !data.enabled
      ? "ANTHROPIC_API_KEY isn't configured."
      : data.readyCalls === 0
        ? "Link a transcribed call to this lead in the Pocket tab first."
        : null;

  return (
    <div className={box}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-white/60">Call → proposal</p>
          <p className="text-xs text-white/50">
            {data ? `${data.readyCalls} linked call${data.readyCalls === 1 ? "" : "s"}` : "Loading…"}
          </p>
        </div>
        <button
          type="button"
          className={primaryBtn}
          disabled={busy || !data || disabledReason !== null}
          title={disabledReason ?? undefined}
          onClick={() => void start("draft", `/api/admin/leads/${leadId}/draft-proposal`)}
        >
          <FileText size={15} />
          {running === "draft" ? "Reading calls and drafting…" : latest ? "Draft again" : "Draft proposal"}
        </button>
      </div>
      {disabledReason && <p className="mt-2 text-xs text-white/55">{disabledReason}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-crimson-light">
          {error}
        </p>
      )}

      {latest && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          <p className="text-xs text-white/50">
            {fmt(latest.createdAt)} · {latest.recordingIds.length} call{latest.recordingIds.length === 1 ? "" : "s"}
            {latest.truncated ? " · oldest call text trimmed to fit" : ""}
          </p>

          {(latest.status === "extracting" || latest.status === "drafting") && (
            <p className="text-sm text-white/70">
              {latest.status === "extracting" ? "Reading the calls…" : "Drafting the proposal…"}
            </p>
          )}

          {latest.status === "failed" && (
            <div className="space-y-2">
              <p className="text-sm text-crimson-light">{latest.error || "This run failed."}</p>
              {latest.failedStage === "draft" && latest.extraction && (
                <button
                  type="button"
                  className={ghostBtn}
                  disabled={busy}
                  onClick={() => void start("retry", `/api/admin/call-briefs/${latest.id}/retry-draft`)}
                >
                  <RefreshCw size={15} />
                  {running === "retry" ? "Drafting…" : "Retry draft"}
                </button>
              )}
            </div>
          )}

          {latest.warnings.length > 0 && (
            <ul className="space-y-1">
              {latest.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-amber-300">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {w.detail}
                </li>
              ))}
            </ul>
          )}

          {latest.proposalId && (
            <a className={ghostBtn} href={proposalHref(latest.proposalId)}>
              <ExternalLink size={15} /> Open draft proposal
            </a>
          )}

          {latest.extraction && (
            <BriefFacts brief={latest.extraction} calls={data?.calls ?? []} recordingIds={latest.recordingIds} />
          )}
        </div>
      )}

      {older.length > 0 && (
        <details className="mt-3 border-t border-white/10 pt-3">
          <summary className="cursor-pointer text-xs text-white/60">Earlier drafts ({older.length})</summary>
          <ul className="mt-2 space-y-1">
            {older.map((b) => (
              <li key={b.id} className="flex flex-wrap gap-2 text-xs text-white/65">
                <span>{fmt(b.createdAt)}</span>
                <span>{b.status}</span>
                {b.proposalId && (
                  <a className="underline underline-offset-4 hover:text-white" href={proposalHref(b.proposalId)}>
                    proposal
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
