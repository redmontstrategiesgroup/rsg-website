/**
 * Pocket: pure rules (no I/O) shared by the API routes and the admin panel.
 * Kept free of "@/" imports so node --test can load it directly.
 */

export const POCKET_STATUSES = ["awaiting_upload", "processing", "ready", "failed"] as const;
export type PocketStatus = (typeof POCKET_STATUSES)[number];

export type PocketSource = "upload" | "pocket";

export type PocketRecording = {
  id: string;
  /** "pocket" = synced from the Pocket API; "upload" = audio uploaded by hand. */
  source: PocketSource;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  recordedAt: string | null;
  status: PocketStatus;
  error: string;
  language: string;
  transcript: string;
  /** Speaker-labelled lines when Pocket provides them. */
  segments: { text: string; start: number | null; end: number | null; speaker: string }[];
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  tags: string[];
  notes: string;
  leadId: string | null;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
};

/** Whisper's hard per-request upload ceiling. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Formats Whisper accepts (and that recorder apps export). */
export const AUDIO_EXTENSIONS = [
  "mp3", "m4a", "wav", "webm", "mp4", "mpeg", "mpga", "ogg", "oga", "flac",
];

/** A recording stuck in `processing` this long is treated as a dead run. */
export const PROCESSING_STALE_MS = 6 * 60_000;

export function audioExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function validateAudioUpload(input: {
  name: string;
  sizeBytes: number;
  mimeType: string;
}): { ok: true } | { ok: false; reason: string } {
  const ext = audioExtension(input.name);
  if (!ext || !AUDIO_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      reason: `Upload an audio file (${AUDIO_EXTENSIONS.map((e) => `.${e}`).join(", ")}).`,
    };
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, reason: "The file is empty." };
  }
  if (input.sizeBytes > MAX_AUDIO_BYTES) {
    return {
      ok: false,
      reason:
        "Recordings must be 25 MB or smaller. Export as MP3/M4A or split long recordings in the recorder app.",
    };
  }
  const mime = input.mimeType.toLowerCase().split(";")[0].trim();
  if (
    mime &&
    mime !== "application/octet-stream" &&
    !mime.startsWith("audio/") &&
    !mime.startsWith("video/")
  ) {
    return { ok: false, reason: `"${mime}" is not an audio file.` };
  }
  return { ok: true };
}

/** Whether a new processing run may start for a recording in this state. */
export function canStartProcessing(
  rec: Pick<PocketRecording, "status" | "updatedAt">,
  now = Date.now(),
): boolean {
  if (rec.status !== "processing") return true;
  const since = now - Date.parse(rec.updatedAt);
  return !Number.isFinite(since) || since > PROCESSING_STALE_MS;
}

/** "1:02:05" / "4:09" for a duration in seconds. */
export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Keep only non-empty strings, trimmed and capped, from untrusted model output. */
export function cleanStringList(value: unknown, max = 20, maxLen = 400): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, max);
}
