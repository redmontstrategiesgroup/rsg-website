/**
 * Pocket public API client (heypocketai.com): the clip-on recorder's cloud.
 * Auth: `Authorization: Bearer pk_...` from POCKET_API_KEY.
 *
 * Server-only. Every call is logged through callProvider("pocket").
 */

import { callProvider } from "@/lib/integration-log";
import { parseAudioUrl, parseListPage } from "@/lib/pocket/parse";

const BASE = (process.env.POCKET_API_BASE ?? "https://public.heypocketai.com/api/v1").replace(/\/$/, "");
const TIMEOUT_MS = 30_000;

export class PocketNotConfiguredError extends Error {
  constructor() {
    super("POCKET_API_KEY isn't configured: add it to the environment first.");
    this.name = "PocketNotConfiguredError";
  }
}

export function pocketConfigured(): boolean {
  return Boolean(process.env.POCKET_API_KEY);
}

async function pocketGet(path: string, operation: string): Promise<unknown> {
  const key = process.env.POCKET_API_KEY;
  if (!key) throw new PocketNotConfiguredError();

  return callProvider({ provider: "pocket", operation }, async () => {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`Pocket ${res.status}: ${body.slice(0, 300)}`) as Error & {
        status?: number;
        request_id?: string;
      };
      err.status = res.status;
      err.request_id = res.headers.get("x-request-id") ?? undefined;
      throw err;
    }
    return res.json();
  });
}

/** One page of recordings (newest filters by date; `page` is 1-based). */
export async function listPocketRecordings(opts: {
  page: number;
  limit?: number;
  startDate?: string;
}): Promise<{ items: unknown[]; hasMore: boolean }> {
  const q = new URLSearchParams({ page: String(opts.page), limit: String(opts.limit ?? 100) });
  if (opts.startDate) q.set("start_date", opts.startDate);
  return parseListPage(await pocketGet(`/public/recordings?${q}`, "pocket.recordings.list"));
}

/** Full recording with transcript + summarizations. */
export async function getPocketRecording(id: string): Promise<unknown> {
  const q = new URLSearchParams({ include_transcript: "true", include_summarizations: "true" });
  const body = await pocketGet(
    `/public/recordings/${encodeURIComponent(id)}?${q}`,
    "pocket.recordings.get",
  );
  return (body as { data?: unknown })?.data ?? null;
}

/** Short-lived pre-signed audio URL for playback. */
export async function getPocketAudioUrl(id: string, expiresIn = 600): Promise<string> {
  const body = await pocketGet(
    `/public/recordings/${encodeURIComponent(id)}/audio-url?expires_in=${expiresIn}`,
    "pocket.recordings.audio_url",
  );
  return parseAudioUrl(body);
}
