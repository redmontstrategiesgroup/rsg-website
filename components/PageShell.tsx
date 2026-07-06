/**
 * Wraps an interior marketing page so its first section clears the fixed
 * navbar and gets a little breathing room at the top.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  return <main className="pt-20">{children}</main>;
}
