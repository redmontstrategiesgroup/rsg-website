import { DEMO_SCHEMA_VERSION, type DemoState } from "./engine";

/**
 * Per-visitor demo session persistence.
 *
 * Sessions live entirely in the visitor's own browser (localStorage), so:
 *  - every visitor is isolated by construction — no shared server state;
 *  - demo records can never mix with production data;
 *  - state survives page navigation and reloads;
 *  - sessions expire automatically and can be reset at any time.
 */

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type StoredSession = {
  schema: number;
  savedAt: number;
  state: DemoState;
};

function key(slug: string): string {
  return `rsg-demo:${slug}`;
}

export function loadSession(slug: string): DemoState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(slug));
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredSession;
    if (
      stored.schema !== DEMO_SCHEMA_VERSION ||
      typeof stored.savedAt !== "number" ||
      Date.now() - stored.savedAt > SESSION_TTL_MS ||
      !stored.state ||
      stored.state.schema !== DEMO_SCHEMA_VERSION
    ) {
      window.localStorage.removeItem(key(slug));
      return null;
    }
    // Sessions are re-hydrated without transient UI state.
    return { ...stored.state, toasts: [] };
  } catch {
    return null;
  }
}

export function saveSession(slug: string, state: DemoState): void {
  if (typeof window === "undefined") return;
  try {
    const stored: StoredSession = {
      schema: DEMO_SCHEMA_VERSION,
      savedAt: Date.now(),
      state: { ...state, toasts: [] },
    };
    window.localStorage.setItem(key(slug), JSON.stringify(stored));
  } catch {
    // Storage may be full or blocked (private mode) — the demo still works
    // in-memory; persistence is best-effort.
  }
}

export function clearSession(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(slug));
  } catch {
    /* ignore */
  }
}

/**
 * Writes a visitor-reviewable draft into the contact form (same mechanism the
 * form itself uses for drafts) so demo context arrives visibly and editably —
 * never silently transmitted.
 */
export function writeContactDraft(fields: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    const KEY = "rsg_contact_draft";
    const existing = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
    window.localStorage.setItem(KEY, JSON.stringify({ ...existing, ...fields }));
  } catch {
    /* ignore */
  }
}
