/**
 * Client-side fetch helpers. Every state-changing request must echo the
 * `rsg_csrf` cookie in the `x-csrf-token` header — the middleware rejects
 * mutating API calls without it (double-submit CSRF protection).
 */

export function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith("rsg_csrf="));
  return match ? match.slice("rsg_csrf=".length) : "";
}

/** POST JSON (or an empty body) with the CSRF header attached. */
export function postJson(url: string, data?: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": getCsrfToken(),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

/** PATCH JSON with the CSRF header attached. */
export function patchJson(url: string, data: unknown): Promise<Response> {
  return fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": getCsrfToken(),
    },
    body: JSON.stringify(data),
  });
}
