/**
 * The public API tree. Middleware skips browser-only checks (bot UA,
 * fetch-metadata, Origin, CSRF) here because bearer auth replaces them.
 * Edge-safe: no imports.
 */
export function isApiV1Path(pathname: string): boolean {
  return pathname === "/api/v1" || pathname.startsWith("/api/v1/");
}
