import { ApiError } from "./errors.ts";

export type Cursor = { createdAt: string; id: string };

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify([c.createdAt, c.id])).toString("base64url");
}

export function decodeCursor(s: string): Cursor | null {
  try {
    const v = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    if (!Array.isArray(v) || v.length !== 2) return null;
    const [createdAt, id] = v;
    if (typeof createdAt !== "string" || typeof id !== "string" || !createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export function parseListParams(sp: URLSearchParams): { limit: number; cursor: Cursor | null } {
  const raw = sp.get("limit");
  let limit: number;
  if (raw === null || raw.trim() === "") {
    limit = DEFAULT_LIMIT;
  } else {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      limit = DEFAULT_LIMIT;
    } else {
      limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(n)));
    }
  }
  const cs = sp.get("cursor");
  if (!cs) return { limit, cursor: null };
  const cursor = decodeCursor(cs);
  if (!cursor) throw new ApiError(422, "validation_failed", "Invalid cursor.", { cursor: ["malformed"] });
  return { limit, cursor };
}

export type CursorQuery = { or(filter: string): unknown };

/** Keyset predicate for `order by created_at desc, id desc`. */
export function applyCursor<Q extends CursorQuery>(query: Q, cursor: Cursor | null): Q {
  if (!cursor) return query;
  return query.or(
    `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
  ) as Q;
}

export function pageResult<T extends { created_at: string; id: string }>(
  rows: T[],
  limit: number,
): { data: T[]; next_cursor: string | null } {
  const data = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = data[data.length - 1];
  return { data, next_cursor: hasMore && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null };
}
