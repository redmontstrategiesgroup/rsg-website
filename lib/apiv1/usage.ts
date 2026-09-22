export type UsageRow = {
  key_id: string | null;
  principal_type: "client" | "admin" | null;
  principal_id: string | null;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  ip: string | null;
  correlation_id: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UsageDb = { from(table: "api_requests"): any };

/** `/api/v1/tickets/abc` + { id: "abc" } → `/v1/tickets/{id}` (no ids in the log). */
export function templatePath(pathname: string, params: Record<string, string>): string {
  const byValue = new Map(Object.entries(params).map(([k, v]) => [v, k]));
  const segs = pathname.split("/").map((s) => (byValue.has(s) ? `{${byValue.get(s)}}` : s));
  const joined = segs.join("/");
  return joined.startsWith("/api/") ? joined.slice(4) : joined;
}

export function recordUsage(db: UsageDb, row: UsageRow): void {
  Promise.resolve()
    .then(() => db.from("api_requests").insert(row))
    .then((r: { error?: { message: string } | null } | void) => {
      if (r && r.error) console.warn("[apiv1] usage insert failed:", r.error.message);
    })
    .catch((err: unknown) => console.warn("[apiv1] usage insert failed:", err));
}
