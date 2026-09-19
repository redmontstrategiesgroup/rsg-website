import { escapeLikePattern } from "../validate.ts";

const MAX_TERM = 80;

/**
 * Free-text search input -> safe ILIKE fragment.
 *
 * Strips ASCII control characters (`\x00`-`\x1f`, `\x7f`) and the three
 * PostgREST `.or()` syntax characters `,` `(` `)` — a user-typed comma or
 * parenthesis would otherwise inject additional `.or()` filter clauses.
 * Interior spaces are kept. The result is trimmed, capped at 80 characters,
 * and run through `escapeLikePattern` so `%`/`_`/`*` match literally. Empty
 * input, or input that becomes empty after stripping, returns `null`.
 */
export function searchTerm(q: string | undefined): string | null {
  if (!q) return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = q.replace(/[\x00-\x1f\x7f,()]/g, "").trim().slice(0, MAX_TERM);
  if (!cleaned) return null;
  return escapeLikePattern(cleaned);
}

export function orIlike(columns: readonly string[], term: string): string {
  return columns.map((c) => `${c}.ilike.%${term}%`).join(",");
}
