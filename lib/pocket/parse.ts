/**
 * Pocket public API: defensive parsing (pure, no I/O).
 *
 * The public docs publish the recording envelope but leave `transcript` and
 * `summarizations` untyped, and the app's own API nests them differently
 * (transcription.transcription.text, summarizations[id].v2.summary.markdown).
 * Every reader here accepts each known shape and falls back to "nothing" rather
 * than throwing, so an API change degrades to an empty field, not a failed sync.
 * Kept free of "@/" imports so node --test can load it directly.
 */

export type TranscriptSegment = {
  text: string;
  start: number | null;
  end: number | null;
  speaker: string;
};

export type ParsedPocketRecording = {
  pocketId: string;
  title: string;
  recordedAt: string | null;
  updatedAt: string | null;
  durationSeconds: number | null;
  language: string;
  state: string;
  tags: string[];
  transcript: string;
  segments: TranscriptSegment[];
  summary: string;
  actionItems: string[];
  error: string;
};

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** Follow a dotted path through nested objects. */
function at(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const key of path.split(".")) {
    if (!isObj(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

function firstString(root: unknown, paths: string[]): string {
  for (const p of paths) {
    const v = str(at(root, p)).trim();
    if (v) return v;
  }
  return "";
}

function toSegments(value: unknown): TranscriptSegment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObj)
    .map((s) => ({
      text: str(s.text ?? s.content).trim(),
      start: num(s.start ?? s.start_time ?? s.startTime),
      end: num(s.end ?? s.end_time ?? s.endTime),
      speaker: str(s.speaker ?? s.speaker_name ?? s.speakerName ?? s.speaker_label).trim(),
    }))
    .filter((s) => s.text);
}

/** Transcript text + speaker segments from any known shape. */
export function extractTranscript(rec: unknown): { text: string; segments: TranscriptSegment[] } {
  const candidates = [
    at(rec, "transcript"),
    at(rec, "transcription.transcription"),
    at(rec, "transcription"),
  ];

  let segments: TranscriptSegment[] = [];
  let text = "";
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      text ||= c.trim();
      continue;
    }
    if (Array.isArray(c)) {
      segments = segments.length ? segments : toSegments(c);
      continue;
    }
    if (isObj(c)) {
      text ||= firstString(c, ["text", "full_text", "fullText", "content"]);
      if (!segments.length) {
        segments = toSegments(c.segments ?? c.utterances ?? c.items);
      }
    }
  }

  if (!text && segments.length) {
    text = segments
      .map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text))
      .join("\n");
  }
  return { text, segments };
}

function actionItemText(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (!isObj(item)) return "";
  const base = firstString(item, ["title", "text", "description", "content", "label", "task"]);
  if (!base) return "";
  const who = firstString(item, ["assignee", "owner", "assigned_to", "assignedTo"]);
  const due = firstString(item, ["due", "due_date", "dueDate", "deadline"]);
  const extra = [who && `owner: ${who}`, due && `due: ${due}`].filter(Boolean).join(", ");
  return extra ? `${base} (${extra})` : base;
}

/** Summaries arrive as an array or an id-keyed map; newest usable one wins. */
function summarizationList(rec: unknown): Obj[] {
  const raw = at(rec, "summarizations") ?? at(rec, "summarization") ?? at(rec, "summary");
  const list = Array.isArray(raw) ? raw : isObj(raw) ? Object.values(raw) : [];
  const objs = list.filter(isObj);
  // A bare `summary: {markdown}` object is itself one summarization.
  if (!objs.length && isObj(raw)) return [raw];
  return objs.sort((a, b) => {
    const ta = Date.parse(str(a.updated_at ?? a.created_at)) || 0;
    const tb = Date.parse(str(b.updated_at ?? b.created_at)) || 0;
    return tb - ta;
  });
}

export function extractSummary(rec: unknown): { summary: string; actionItems: string[] } {
  const plain = str(at(rec, "summary")).trim();
  for (const s of summarizationList(rec)) {
    const summary = firstString(s, [
      "v2.summary.markdown",
      "v2.summary.text",
      "summary.markdown",
      "summary.text",
      "summary",
      "markdown",
      "content.markdown",
      "content",
      "text",
    ]);
    const rawItems =
      at(s, "v2.actionItems.items") ??
      at(s, "v2.action_items.items") ??
      at(s, "actionItems.items") ??
      at(s, "action_items.items") ??
      at(s, "actionItems") ??
      at(s, "action_items");
    const actionItems = Array.isArray(rawItems)
      ? rawItems.map(actionItemText).filter(Boolean).slice(0, 30)
      : [];
    if (summary || actionItems.length) return { summary, actionItems };
  }
  return { summary: plain, actionItems: [] };
}

/** One Pocket recording object -> the fields we store. Null if it has no id. */
export function parsePocketRecording(rec: unknown): ParsedPocketRecording | null {
  if (!isObj(rec)) return null;
  const pocketId = str(rec.id).trim() || (num(rec.id) != null ? String(rec.id) : "");
  if (!pocketId) return null;

  const { text, segments } = extractTranscript(rec);
  const { summary, actionItems } = extractSummary(rec);
  const tags = Array.isArray(rec.tags)
    ? rec.tags.map((t) => (isObj(t) ? str(t.name) : str(t)).trim()).filter(Boolean)
    : [];
  const errors = [
    str(rec.transcript_error),
    ...(Array.isArray(rec.summarizations_errors) ? rec.summarizations_errors.map(str) : []),
  ].filter((e) => e.trim());

  return {
    pocketId,
    title: str(rec.title).trim(),
    recordedAt: str(rec.recording_at ?? rec.recorded_at ?? rec.created_at) || null,
    updatedAt: str(rec.updated_at) || null,
    durationSeconds: num(rec.duration),
    language: str(rec.language),
    state: str(rec.state).toLowerCase(),
    tags,
    transcript: text,
    segments,
    summary,
    actionItems,
    error: errors.join("; ").slice(0, 500),
  };
}

/**
 * Our status for a synced recording. Pocket processes on its side, so "ready"
 * means it has a transcript; an explicit failure state or transcript error is
 * "failed"; anything else is still processing.
 */
export function pocketStatus(p: Pick<ParsedPocketRecording, "transcript" | "state" | "error">):
  | "processing"
  | "ready"
  | "failed" {
  if (p.transcript) return "ready";
  if (/fail|error/.test(p.state) || p.error) return "failed";
  return "processing";
}

/** The list endpoint's `data` array and whether more pages exist. */
export function parseListPage(body: unknown): { items: unknown[]; hasMore: boolean } {
  const data = at(body, "data");
  const items = Array.isArray(data) ? data : isObj(data) && Array.isArray(data.items) ? data.items : [];
  return { items, hasMore: at(body, "pagination.has_more") === true };
}

/** The audio-url endpoint returns the URL as `data`, `data.url` or similar. */
export function parseAudioUrl(body: unknown): string {
  const d = at(body, "data");
  const url =
    (typeof d === "string" ? d : "") ||
    firstString(body, ["data.url", "data.download_url", "data.audio_url", "data.signed_url", "url"]);
  return /^https:\/\//.test(url) ? url : "";
}

/** Recording id from a webhook payload (`recording.id`, `recording_id`, `data.id`). */
export function webhookRecordingId(payload: unknown): string {
  return firstString(payload, ["recording.id", "recording_id", "recordingId", "data.recording.id", "data.id"]);
}
