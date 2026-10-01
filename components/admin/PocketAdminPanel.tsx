"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Mic,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { getCsrfToken, patchJson, postJson } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { proposalHref } from "@/components/admin/CallProposalPanel";
import {
  AUDIO_EXTENSIONS,
  formatDuration,
  validateAudioUpload,
  type PocketRecording,
  type PocketStatus,
} from "@/lib/pocket/rules";

const STATUS_LABEL: Record<PocketStatus, string> = {
  awaiting_upload: "Upload incomplete",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_TONE: Record<PocketStatus, string> = {
  awaiting_upload: "text-amber-300/80",
  processing: "text-sky-300/80",
  ready: "text-emerald-300/80",
  failed: "text-red-300/80",
};

const ACCEPT = ["audio/*", ...AUDIO_EXTENSIONS.map((e) => `.${e}`)].join(",");

type SyncResult = {
  checked: number;
  imported: number;
  updated: number;
  unchanged: number;
  failed: number;
  more: boolean;
};

function formatBytes(n: number): string {
  if (!n) return "";
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function syncSummary(r: SyncResult): string {
  const parts = [
    r.imported && `${r.imported} new`,
    r.updated && `${r.updated} updated`,
    r.failed && `${r.failed} failed`,
  ].filter(Boolean);
  const head = parts.length ? `Synced: ${parts.join(", ")}.` : "Up to date with Pocket.";
  return r.more ? `${head} More remain: sync again to continue.` : head;
}

/**
 * Pocket: recordings from the Pocket clip-on AI recorder on the back of the
 * phone. Synced from the Pocket API (transcript + summary come from Pocket),
 * with manual audio upload (Whisper + Claude) as a fallback.
 */
export function PocketAdminPanel({ leads }: { leads: Lead[] }) {
  const [rows, setRows] = useState<PocketRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<"" | "uploading" | "processing">("");
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const autoSynced = useRef(false);

  async function load(): Promise<boolean> {
    setError("");
    try {
      const res = await fetch("/api/admin/pocket");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not load recordings.");
        return false;
      }
      const list = (data.recordings ?? []) as PocketRecording[];
      setRows(list);
      setConfigured(Boolean(data.pocketConfigured));
      setSelectedId((cur) => (list.some((r) => r.id === cur) ? cur : list[0]?.id || ""));
      return Boolean(data.pocketConfigured);
    } catch {
      setError("Network error loading recordings.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setNote("");
    try {
      const res = await postJson("/api/admin/pocket/sync");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(data.error ?? "Pocket sync failed.");
        return;
      }
      setNote(syncSummary(data.result as SyncResult));
      await load();
    } catch {
      setNote("Network error while syncing. Try again.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    // Show what's stored straight away, then pull anything new from Pocket.
    void load().then((isConfigured) => {
      if (isConfigured && !autoSynced.current) {
        autoSynced.current = true;
        void sync();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function upsert(rec: PocketRecording) {
    setRows((prev) =>
      prev.some((r) => r.id === rec.id)
        ? prev.map((r) => (r.id === rec.id ? rec : r))
        : [rec, ...prev],
    );
  }

  async function runProcessing(id: string) {
    setBusy("processing");
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "processing", error: "" } : r)),
    );
    try {
      const res = await postJson("/api/admin/pocket/process", { id });
      const data = await res.json().catch(() => ({}));
      if (data.recording) upsert(data.recording as PocketRecording);
      if (!res.ok && !data.recording) setNote(data.error ?? "Processing failed.");
    } catch {
      // The request can outlive a flaky mobile connection; the server keeps going.
      setNote("Lost connection while processing. Tap Refresh in a minute to see the result.");
    } finally {
      setBusy("");
    }
  }

  async function upload(file: File) {
    setNote("");
    const mimeType = file.type || "application/octet-stream";
    const verdict = validateAudioUpload({ name: file.name, sizeBytes: file.size, mimeType });
    if (!verdict.ok) {
      setNote(verdict.reason);
      return;
    }

    setBusy("uploading");
    try {
      const res = await postJson("/api/admin/pocket", {
        name: file.name,
        sizeBytes: file.size,
        mimeType,
        title: title.trim() || undefined,
        recordedAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.uploadUrl || !data.recording) {
        setNote(data.error ?? "That file couldn't be accepted.");
        setBusy("");
        return;
      }
      const rec = data.recording as PocketRecording;
      upsert(rec);
      setSelectedId(rec.id);

      const put = await fetch(data.uploadUrl as string, {
        method: "PUT",
        headers: { "content-type": mimeType },
        body: file,
      });
      if (!put.ok) {
        setNote("Upload failed. Delete the incomplete recording and try again.");
        setBusy("");
        return;
      }
      setTitle("");
      await runProcessing(rec.id);
    } catch {
      setNote("Network error during upload. Try again.");
      setBusy("");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex flex-wrap gap-2">
          {configured ? (
            <button
              type="button"
              onClick={() => void sync()}
              disabled={syncing}
              className="btn-primary inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
            >
              {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {syncing ? "Syncing…" : "Sync from Pocket"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            className="btn-ghost inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {!loading && !configured ? (
        <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100/80">
          Pocket sync is off: set <code className="font-mono text-xs">POCKET_API_KEY</code> on
          the server (Pocket app → Settings → Developer → API Keys). Manual uploads still work.
        </p>
      ) : null}

      {note ? (
        <p className="text-sm text-white/60" role="status">
          {note}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/65">
          <Loader2 className="animate-spin" size={16} /> Loading recordings…
        </div>
      ) : !rows.length ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 p-10 text-center">
          <Mic size={22} className="text-white/60" />
          <p className="text-sm text-white/65">
            {syncing
              ? "Pulling recordings from Pocket…"
              : configured
                ? "No recordings yet. Record on your Pocket and sync."
                : "No recordings yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <aside className="max-h-[70vh] divide-y divide-white/6 overflow-y-auto rounded-xl border border-white/10">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setSelectedId(row.id);
                  if (window.matchMedia("(max-width: 1023px)").matches) {
                    requestAnimationFrame(() =>
                      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                    );
                  }
                }}
                className={`w-full p-4 text-left ${
                  selectedId === row.id ? "bg-crimson/8" : "hover:bg-white/2.5"
                }`}
              >
                <p className="truncate text-sm font-medium text-white/85">
                  {row.title || row.fileName || "Untitled recording"}
                </p>
                <p
                  className={`mt-1 text-xs font-medium uppercase tracking-wide ${STATUS_TONE[row.status]}`}
                >
                  {STATUS_LABEL[row.status]}
                  {row.source === "upload" ? " · Uploaded" : ""}
                </p>
                <p className="mt-1 truncate text-xs text-white/60">
                  {[formatWhen(row.recordedAt ?? row.createdAt), formatDuration(row.durationSeconds)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </button>
            ))}
          </aside>

          <div ref={detailRef} className="scroll-mt-24">
            {selected ? (
              <RecordingDetail
                key={selected.id}
                rec={selected}
                leads={leads}
                busy={busy !== ""}
                onChange={upsert}
                onRetry={() => void runProcessing(selected.id)}
                onDeleted={() => {
                  setRows((prev) => prev.filter((r) => r.id !== selected.id));
                  setSelectedId("");
                }}
              />
            ) : (
              <p className="text-sm text-white/60">Select a recording.</p>
            )}
          </div>
        </div>
      )}

      {/* Manual upload: audio from anywhere, transcribed by Whisper. */}
      <details className="rounded-xl border border-white/10 bg-white/2" open={!configured}>
        <summary className="cursor-pointer px-4 py-3 text-sm text-white/70 sm:px-5">
          Upload an audio file instead
        </summary>
        <div className="border-t border-white/10 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1 text-sm">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/60">
                Title (optional: AI names it otherwise)
              </span>
              <input
                className="w-full rounded-lg border border-white/10 bg-white/3 px-3 py-2.5"
                value={title}
                maxLength={200}
                placeholder="e.g. Site visit, Main St bakery"
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy !== ""}
              />
            </label>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              id="pocket-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
              disabled={busy !== ""}
            />
            <label
              htmlFor="pocket-file"
              aria-disabled={busy !== ""}
              className={`btn-ghost inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 px-5 py-2.5 text-sm ${
                busy ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {busy === "uploading" ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Uploading…
                </>
              ) : busy === "processing" ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Transcribing…
                </>
              ) : (
                <>
                  <Upload size={16} /> Choose audio file
                </>
              )}
            </label>
          </div>
          <p className="mt-3 text-xs text-white/60">
            MP3, M4A, WAV and other audio up to 25 MB, transcribed with Whisper. Takes about a
            minute per 20 minutes of audio; keep this page open.
          </p>
        </div>
      </details>
    </div>
  );
}

/** Minimal markdown for Pocket summaries: headings, bullets, bold, paragraphs. */
function Markdown({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-medium text-white/90">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );

  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{inline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flush();
    if (!line) continue;
    if (heading) {
      blocks.push(
        <p key={blocks.length} className="pt-1 font-medium text-white/90">
          {inline(heading[1])}
        </p>,
      );
    } else {
      blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }
  flush();
  return <div className="space-y-2.5 text-sm leading-relaxed text-white/80">{blocks}</div>;
}

function RecordingDetail({
  rec,
  leads,
  busy,
  onChange,
  onRetry,
  onDeleted,
}: {
  rec: PocketRecording;
  leads: Lead[];
  busy: boolean;
  onChange: (rec: PocketRecording) => void;
  onRetry: () => void;
  onDeleted: () => void;
}) {
  const [audioUrl, setAudioUrl] = useState("");
  const [audioNote, setAudioNote] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (rec.status === "awaiting_upload") return;
    let cancelled = false;
    setAudioUrl("");
    setAudioNote("");
    fetch(`/api/admin/pocket/audio?id=${rec.id}`)
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
      .then(({ ok, d }) => {
        if (cancelled) return;
        if (ok && d.url) setAudioUrl(d.url as string);
        else setAudioNote((d.error as string) ?? "Audio unavailable.");
      })
      .catch(() => {
        if (!cancelled) setAudioNote("Audio unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [rec.id, rec.status]);

  async function save(patch: { title?: string; notes?: string; leadId?: string | null }) {
    setMessage("");
    const res = await patchJson("/api/admin/pocket", { id: rec.id, ...patch });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error ?? "Save failed.");
      return;
    }
    onChange(data.recording as PocketRecording);
    setMessage("Saved.");
  }

  async function remove() {
    const res = await fetch(`/api/admin/pocket?id=${rec.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrfToken() },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Delete failed.");
      setConfirmDelete(false);
      return;
    }
    onDeleted();
  }

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setMessage("Couldn't copy: select the text instead.");
    }
  }

  const fullNotes = [
    rec.title,
    rec.summary,
    rec.keyPoints.length ? `Key points:\n${rec.keyPoints.map((p) => `- ${p}`).join("\n")}` : "",
    rec.actionItems.length
      ? `Action items:\n${rec.actionItems.map((a) => `- ${a}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const hasSpeakers = rec.segments.some((s) => s.speaker);

  return (
    <div className="space-y-5 rounded-xl border border-white/10 p-4 sm:p-5">
      <label className="block text-sm">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/60">
          Title
        </span>
        <input
          className="w-full rounded-lg border border-white/10 bg-white/3 px-3 py-2.5 text-base"
          defaultValue={rec.title}
          maxLength={200}
          placeholder={rec.fileName || "Untitled recording"}
          onBlur={(e) => {
            if (e.target.value !== rec.title) void save({ title: e.target.value });
          }}
        />
      </label>

      <p className="text-xs text-white/60">
        {[
          rec.source === "pocket" ? "Pocket" : "Uploaded",
          formatWhen(rec.recordedAt ?? rec.createdAt),
          formatDuration(rec.durationSeconds),
          formatBytes(rec.sizeBytes),
          rec.language ? rec.language.toUpperCase() : "",
          rec.fileName,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {rec.tags.length ? (
        <div className="flex flex-wrap gap-1.5">
          {rec.tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/55"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {audioUrl ? (
        <audio controls preload="none" src={audioUrl} className="w-full">
          <track kind="captions" />
        </audio>
      ) : audioNote ? (
        <p className="text-xs text-white/60">{audioNote} The transcript below is unaffected.</p>
      ) : null}

      {rec.status === "processing" ? (
        <p className="flex items-center gap-2 text-sm text-sky-200/80">
          <Loader2 size={15} className="animate-spin" />
          {rec.source === "pocket"
            ? "Pocket is still processing this recording. Sync again shortly."
            : "Transcribing and summarizing…"}
        </p>
      ) : null}

      {rec.status === "failed" || rec.status === "awaiting_upload" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-400/20 bg-red-500/6 p-3">
          <AlertTriangle size={16} className="text-red-300" />
          <p className="flex-1 text-sm text-red-200/90">
            {rec.status === "failed"
              ? rec.error || "Processing failed."
              : "The audio never finished uploading. Retry, or delete and upload again."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className="btn-ghost inline-flex items-center gap-2 px-3 py-1.5 text-sm"
          >
            <RotateCcw size={14} /> Retry
          </button>
        </div>
      ) : null}

      {rec.summary ? (
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-white/60">
              Summary
            </h3>
            <button
              type="button"
              onClick={() => void copy("notes", fullNotes)}
              className="inline-flex items-center gap-1.5 text-xs text-white/65 hover:text-white/80"
            >
              {copied === "notes" ? <Check size={13} /> : <Copy size={13} />} Copy notes
            </button>
          </div>
          <Markdown text={rec.summary} />
        </section>
      ) : null}

      {rec.keyPoints.length ? (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/60">
            Key points
          </h3>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-white/75">
            {rec.keyPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {rec.actionItems.length ? (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/60">
            Action items
          </h3>
          <ul className="space-y-1.5 text-sm text-white/80">
            {rec.actionItems.map((a, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-crimson" />
                {a}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/60">
            Linked lead
          </span>
          <select
            className="w-full rounded-lg border border-white/10 bg-base-800 px-3 py-2.5"
            value={rec.leadId ?? ""}
            onChange={(e) => void save({ leadId: e.target.value || null })}
          >
            <option value="">Not linked</option>
            {leads
              .filter((l): l is Lead & { id: string } => Boolean(l.id))
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.company ? `${l.company} (${l.name})` : l.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <DraftFromCall leadId={rec.leadId} />

      <label className="block text-sm">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/60">
          Notes
        </span>
        <textarea
          className="min-h-24 w-full rounded-lg border border-white/10 bg-white/3 px-3 py-2.5"
          defaultValue={rec.notes}
          maxLength={8000}
          onBlur={(e) => {
            if (e.target.value !== rec.notes) void save({ notes: e.target.value });
          }}
        />
      </label>

      {rec.transcript ? (
        <details className="rounded-lg border border-white/10">
          <summary className="cursor-pointer px-3 py-2.5 text-sm text-white/70">
            Full transcript
          </summary>
          <div className="border-t border-white/10 px-3 py-3">
            <button
              type="button"
              onClick={() => void copy("transcript", rec.transcript)}
              className="mb-2 inline-flex items-center gap-1.5 text-xs text-white/65 hover:text-white/80"
            >
              {copied === "transcript" ? <Check size={13} /> : <Copy size={13} />} Copy transcript
            </button>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto text-sm leading-relaxed text-white/65">
              {hasSpeakers ? (
                rec.segments.map((s, i) => (
                  <p key={i}>
                    <span className="font-medium text-white/85">
                      {s.speaker || "Speaker"}
                      {s.start != null ? (
                        <span className="ml-1.5 font-mono text-xs text-white/60">
                          {formatDuration(s.start)}
                        </span>
                      ) : null}
                    </span>
                    <br />
                    {s.text}
                  </p>
                ))
              ) : (
                <p className="whitespace-pre-wrap">{rec.transcript}</p>
              )}
            </div>
          </div>
        </details>
      ) : null}

      {message ? <p className="text-sm text-white/65">{message}</p> : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
        {confirmDelete ? (
          <>
            <span className="text-sm text-white/60">
              {rec.source === "pocket"
                ? "Remove from the console? It stays in your Pocket app and won't re-sync."
                : "Delete the audio and transcript for good?"}
            </span>
            <button
              type="button"
              onClick={() => void remove()}
              className="inline-flex items-center gap-2 rounded-lg bg-red-500/80 px-3 py-1.5 text-sm text-white hover:bg-red-500"
            >
              <Trash2 size={14} /> {rec.source === "pocket" ? "Remove" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="btn-ghost px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy && rec.status === "processing"}
            className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-red-300"
          >
            <Trash2 size={14} /> {rec.source === "pocket" ? "Remove recording" : "Delete recording"}
          </button>
        )}
      </div>
    </div>
  );
}

function DraftFromCall({ leadId }: { leadId: string | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);

  if (!leadId) {
    return (
      <p className="text-xs text-white/60">
        Link this call to a lead above to draft a proposal from it.
      </p>
    );
  }

  async function draft() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await postJson(`/api/admin/leads/${leadId}/draft-proposal`, {});
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.proposalId) {
        setProposalId(body.proposalId);
        setMessage("Draft ready. It used every call linked to this lead.");
      } else {
        setMessage(body.error ?? "Drafting failed.");
      }
    } catch {
      setMessage("Network error: the draft may still be running. Check the lead in a minute.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void draft()}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-crimson px-3 py-2 text-sm font-medium text-white hover:bg-crimson-light disabled:opacity-50"
      >
        {busy ? "Reading calls and drafting…" : "Draft proposal"}
      </button>
      {proposalId && (
        <a className="text-sm text-white/70 underline underline-offset-4 hover:text-white" href={proposalHref(proposalId)}>
          Open draft proposal
        </a>
      )}
      {message && (
        <p role="status" className="w-full text-xs text-white/65">
          {message}
        </p>
      )}
    </div>
  );
}
