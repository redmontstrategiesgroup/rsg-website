"use client";

import { useEffect, useState } from "react";
import { Copy, RefreshCw, Send, Sparkles } from "lucide-react";
import { postJson } from "@/lib/api";
import { blendScore, bucketOf } from "@/lib/lead-ai/blend";
import type { LeadInsight } from "@/lib/lead-ai/types";

type Props = {
  leadId: string;
  leadEmail: string;
  ruleScore: number;
  /** Phase 3: the blend is written to lead_score. Before that it is only suggested. */
  applied: boolean;
  onSent: () => void;
  onAnalyzed?: (latest: LeadInsight | null) => void;
};

// Class strings follow the current expanded-lead markup in AdminConsole.tsx
// (Recommended plan box, inputClass, ghost link buttons).
const box = "rounded-lg border border-white/10 bg-white/2 p-3.5";
const focusRing =
  "transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-crimson-light";
const ghostBtn = `inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-white disabled:opacity-50 ${focusRing}`;
const primaryBtn = `inline-flex items-center gap-2 rounded-lg bg-crimson px-3 py-2 text-sm font-medium text-white hover:bg-crimson-light disabled:opacity-50 ${focusRing}`;
const field =
  "w-full rounded-lg border border-white/35 bg-white/3 px-3.5 py-2.5 text-sm text-white placeholder:text-white/45 transition-colors focus:border-crimson focus:outline-hidden focus:ring-2 focus:ring-crimson/20";

const FLAG_LABELS: Record<string, string> = {
  spam: "spam",
  vendor_pitch: "a vendor pitch",
  job_seeker: "a job seeker",
  student: "a student",
  out_of_scope: "out of scope",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LeadAiPanel({ leadId, leadEmail, ruleScore, applied, onSent, onAnalyzed }: Props) {
  const [latest, setLatest] = useState<LeadInsight | null>(null);
  const [lastSent, setLastSent] = useState<LeadInsight | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function apply(data: { latest?: LeadInsight | null; lastSent?: LeadInsight | null; enabled?: boolean }) {
    const next = data.latest ?? null;
    setLatest(next);
    setLastSent(data.lastSent ?? null);
    if (typeof data.enabled === "boolean") setEnabled(data.enabled);
    setSubject(next?.draftSubject ?? "");
    setBody(next?.draftBody ?? "");
    setConfirming(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/leads/${leadId}/analyze`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setError(data.error ?? "Could not load the AI analysis.");
        else apply(data);
      } catch {
        if (!cancelled) setError("Network error: could not load the AI analysis.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  async function generate() {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await postJson(`/api/admin/leads/${leadId}/analyze`);
      const data = await res.json().catch(() => ({}));
      if ("latest" in data) {
        apply(data);
        onAnalyzed?.(data.latest ?? null);
      }
      if (!res.ok) setError(data.error ?? "Analysis failed. Try again.");
    } catch {
      setError("Network error: try again.");
    } finally {
      setRunning(false);
    }
  }

  async function send() {
    if (!latest || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await postJson(`/api/admin/leads/${leadId}/reply`, {
        insightId: latest.id,
        subject,
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send the reply.");
        setConfirming(false);
        return;
      }
      setLatest(data.insight);
      setLastSent(data.insight);
      setConfirming(false);
      onSent();
    } catch {
      setError("Network error: the reply may not have been sent. Refresh before retrying.");
      setConfirming(false);
    } finally {
      setSending(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed: select the text manually.");
    }
  }

  const ok = latest?.status === "ok" ? latest : null;
  const blended = ok?.adjustment != null ? blendScore(ruleScore, ok.adjustment) : null;
  const sentHere = latest?.sentAt && latest.sentBody ? latest : null;
  const sendUnknown = Boolean(latest?.sentAt && !latest.sentBody);
  const hasDraft = Boolean(ok && !ok.sentAt && ok.draftBody);

  return (
    <div className={box}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60">
          <Sparkles size={13} aria-hidden="true" /> Claude analysis
        </p>
        {latest && (
          <button type="button" onClick={generate} disabled={running || sending || !enabled} className={ghostBtn}>
            <RefreshCw size={14} aria-hidden="true" className={running ? "animate-spin" : ""} />
            {running ? "Analyzing…" : "Regenerate"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-amber-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-2 text-sm text-white/60">Loading…</p>
      ) : !latest ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-white/65">
            {enabled ? "Not analyzed yet." : "Add ANTHROPIC_API_KEY to enable Claude analysis."}
          </p>
          <button type="button" onClick={generate} disabled={running || sending || !enabled} className={primaryBtn}>
            <Sparkles size={14} aria-hidden="true" />
            {running ? "Analyzing…" : "Generate"}
          </button>
        </div>
      ) : latest.status === "failed" ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-amber-300">Analysis failed: {latest.error ?? "unknown error"}</p>
          <button type="button" onClick={generate} disabled={running || sending || !enabled} className={ghostBtn}>
            Retry
          </button>
        </div>
      ) : null}

      {ok && blended != null && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-white">
            <span className="font-semibold tabular-nums">{blended}</span>{" "}
            <span className="text-white/65">· {bucketOf(blended)}</span>
            <span className="ml-2 text-xs text-white/60">
              rule {ruleScore} · {ok.adjustment! >= 0 ? "+" : ""}
              {ok.adjustment} Claude{applied ? "" : " (suggested, not applied)"}
            </span>
          </p>
          {ok.rationale && <p className="text-sm leading-relaxed text-white/70">{ok.rationale}</p>}
          {ok.signals && (ok.signals.positive.length > 0 || ok.signals.negative.length > 0) && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Signals">
              {ok.signals.positive.map((s) => (
                <li key={`p-${s}`} className="rounded-full border border-emerald-400/30 px-2 py-0.5 text-xs text-emerald-200">
                  + {s}
                </li>
              ))}
              {ok.signals.negative.map((s) => (
                <li key={`n-${s}`} className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-white/65">
                  − {s}
                </li>
              ))}
            </ul>
          )}
          {ok.redFlags.length > 0 && (
            <p className="text-xs text-amber-300">
              Red flags: {ok.redFlags.map((f) => FLAG_LABELS[f] ?? f).join(", ")}
            </p>
          )}
        </div>
      )}

      {lastSent?.sentBody && !sentHere && !sendUnknown && (
        <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-sm text-amber-200">
          Already replied on {fmt(lastSent.sentAt!)}: “{lastSent.sentSubject}”. Sending this draft
          would be a second email.
        </p>
      )}

      {sendUnknown && (
        <p role="alert" className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-sm text-amber-200">
          Send status unknown: the email may not have gone out. Check your Sent mail before retrying.
        </p>
      )}

      {sentHere && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-medium text-white/60">Sent {fmt(sentHere.sentAt!)}</p>
          <p className="text-sm font-medium text-white">{sentHere.sentSubject}</p>
          <p className="whitespace-pre-wrap text-sm text-white/70">{sentHere.sentBody}</p>
        </div>
      )}

      {ok && !ok.sentAt && !ok.draftBody && (
        <p className="mt-3 text-sm text-white/65">
          No reply drafted
          {ok.redFlags.length ? `: looks like ${ok.redFlags.map((f) => FLAG_LABELS[f] ?? f).join(", ")}.` : "."}
        </p>
      )}

      {hasDraft && (
        <div className="mt-3 space-y-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-white/75">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-white/75">Reply to {leadEmail}</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} maxLength={5000} className={field} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {confirming ? (
              <>
                <span className="text-sm text-white/75">Send to {leadEmail}?</span>
                <button type="button" onClick={send} disabled={sending || running || !subject.trim() || !body.trim()} className={primaryBtn}>
                  <Send size={14} aria-hidden="true" />
                  {sending ? "Sending…" : "Confirm send"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={sending} className={ghostBtn}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} disabled={running || !subject.trim() || !body.trim()} className={primaryBtn}>
                <Send size={14} aria-hidden="true" /> Send reply
              </button>
            )}
            <button type="button" onClick={copy} className={ghostBtn}>
              <Copy size={14} aria-hidden="true" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
