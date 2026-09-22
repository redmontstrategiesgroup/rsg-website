/**
 * Pure helpers behind the demo window's swipe / prev-next section
 * navigation. Kept free of React so they can be unit-tested under
 * `node --test`.
 */

/** Minimum horizontal travel (px) before a drag counts as a swipe. */
export const SWIPE_MIN_PX = 50;

/**
 * Horizontal travel must beat vertical by this factor, so a diagonal drag
 * that is really a scroll through a long list is left alone.
 */
const SWIPE_AXIS_RATIO = 1.5;

/**
 * The id one step before (`-1`) or after (`1`) `current`, or `null` at the
 * ends. No wrap-around: a swipe past the last section does nothing rather
 * than surprising the visitor with a jump to the first.
 */
export function adjacentSection<T extends string>(
  ids: readonly T[],
  current: T | string,
  dir: 1 | -1
): T | null {
  const idx = ids.indexOf(current as T);
  if (idx < 0) return null;
  return ids[idx + dir] ?? null;
}

/**
 * Classify a completed drag. `dx`/`dy` are end minus start. Returns `1` for
 * a leftward swipe (next section), `-1` for rightward (previous), `0` for
 * anything that should not change section.
 */
export function swipeDirection(dx: number, dy: number): 1 | -1 | 0 {
  const ax = Math.abs(dx);
  if (ax < SWIPE_MIN_PX) return 0;
  if (ax < Math.abs(dy) * SWIPE_AXIS_RATIO) return 0;
  return dx < 0 ? 1 : -1;
}
