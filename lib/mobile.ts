export function clampViewportHeight(height: number) {
  const safeHeight = Math.round(height);
  if (safeHeight < 420) return Math.max(320, Math.min(420, safeHeight));
  return Math.max(420, Math.min(620, safeHeight));
}
