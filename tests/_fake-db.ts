/**
 * In-memory stand-in for the Supabase client used by the store tests.
 *
 * The point is not query fidelity — it is the CONSTRAINTS. Every table the
 * API platform writes to is declared below with the primary key, unique
 * indexes (including partial ones) and check constraints from the
 * migrations, and inserts/updates fail with the Postgres codes the real
 * database returns (23505 unique_violation, 23514 check_violation). The
 * bespoke fakes this replaces accepted anything, which is how a global
 * UNIQUE on webhook_deliveries.idempotency_key silently broke fan-out
 * (see 20260921140000_webhook_deliveries_fanout.sql).
 *
 * Keep `API_PLATFORM_SCHEMA` in step with supabase/migrations — a
 * constraint that exists in Postgres but not here is a test that can pass
 * while production fails.
 */

export type Row = Record<string, unknown>;

export type TableSchema = {
  /** Column(s) forming the primary key. */
  pk?: string[];
  /** Unique indexes; `where` makes it partial (rows failing the predicate are exempt). */
  unique?: { columns: string[]; where?: (row: Row) => boolean; name?: string }[];
  /** Check constraints: allowed values per column, or a predicate over the row. */
  checks?: Record<string, readonly unknown[] | ((row: Row) => boolean)>;
  /** Column defaults applied on insert when absent. */
  defaults?: () => Row;
};

export type Schema = Record<string, TableSchema>;

/** Mirrors supabase/migrations for the tables touched by lib/apiv1 and lib/webhooks. */
export const API_PLATFORM_SCHEMA: Schema = {
  api_keys: {
    pk: ["id"],
    unique: [{ columns: ["key_hash"], name: "api_keys_key_hash_key" }],
    checks: {
      principal_type: ["client", "admin"],
      name: (r) => typeof r.name === "string" && r.name.length >= 1 && r.name.length <= 80,
    },
    defaults: () => ({ id: uuid(), created_at: nowIso(), last_used_at: null, expires_at: null, revoked_at: null }),
  },
  api_idempotency: {
    pk: ["principal_id", "key"],
    checks: { status: ["in_flight", "done"] },
    defaults: () => ({ response_status: null, response_body: null, created_at: nowIso() }),
  },
  api_requests: {
    pk: ["id"],
    defaults: () => ({ id: seq++, created_at: nowIso() }),
  },
  webhook_endpoints: {
    pk: ["id"],
    checks: {
      kind: ["client", "registry"],
      owner_type: [null, undefined, "client", "admin"],
    },
    defaults: () => ({
      id: uuid(), created_at: nowIso(), updated_at: nowIso(), enabled: true, events: [], description: null,
      owner_type: null, owner_id: null, api_key_id: null, disabled_at: null, failure_count: 0, seq: 0,
    }),
  },
  webhook_deliveries: {
    pk: ["id"],
    // After 20260921140000_webhook_deliveries_fanout.sql this is the ONLY unique index
    // besides the pk: per-endpoint dedupe. There is deliberately no global
    // uniqueness on idempotency_key.
    unique: [{ columns: ["endpoint_id", "event_id"], where: (r) => r.event_id != null, name: "webhook_deliveries_event_uniq" }],
    checks: { status: ["pending", "sending", "delivered", "failed", "dead"] },
    defaults: () => ({
      id: uuid(), created_at: nowIso(), attempts: 0, response_status: null, last_error: null,
      delivered_at: null, dead_lettered_at: null, claimed_at: null, claimed_by: null,
    }),
  },
};

let seq = 1;
export function uuid(): string {
  const n = (seq++).toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${n}`;
}
function nowIso(): string {
  return new Date().toISOString();
}

export type DbError = { code: string; message: string; details?: string };

type Filter = (row: Row) => boolean;
type Result = { data: unknown; error: DbError | null; count?: number | null };

/**
 * Minimal builder: `from(table).select/insert/update/delete` + the filters the
 * stores use. Terminates via `await` (thenable), `.maybeSingle()` or `.single()`.
 * `select("*", { count: "exact", head: true })` returns `count` with `data: null`.
 */
export function fakeDb(schema: Schema, initial: Partial<Record<string, Row[]>> = {}, opts: { rpc?: (fn: string, args: Row) => unknown } = {}) {
  const tables = new Map<string, Row[]>();
  // Seeded rows get column defaults too, as they would have when inserted for real.
  for (const t of Object.keys(schema)) tables.set(t, (initial[t] ?? []).map((r) => ({ ...(schema[t]?.defaults?.() ?? {}), ...r })));
  const calls: string[] = [];

  function violation(table: string, row: Row, existing: Row[]): DbError | null {
    const spec = schema[table];
    if (!spec) return null;
    for (const [col, check] of Object.entries(spec.checks ?? {})) {
      const ok = typeof check === "function" ? check(row) : check.includes(row[col]);
      if (!ok) return { code: "23514", message: `new row for relation "${table}" violates check constraint on "${col}"` };
    }
    const uniques = [...(spec.pk ? [{ columns: spec.pk, name: `${table}_pkey` }] : []), ...(spec.unique ?? [])];
    for (const u of uniques) {
      if (u.where && !u.where(row)) continue;
      const clash = existing.some((r) => r !== row && (!u.where || u.where(r)) && u.columns.every((c) => r[c] === row[c]));
      if (clash) return { code: "23505", message: `duplicate key value violates unique constraint "${u.name ?? u.columns.join("_")}"` };
    }
    return null;
  }

  function from(table: string) {
    const rows = tables.get(table);
    if (!rows) throw new Error(`fakeDb: unknown table ${table}`);
    const filters: Filter[] = [];
    let mode: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    let countOnly = false;
    let order: { col: string; asc: boolean }[] = [];
    let limit: number | null = null;
    let earlyError: DbError | null = null;

    const q: Record<string, unknown> = {};
    const log = (m: string, ...a: unknown[]) => calls.push(`${table}.${m}${a.length ? ":" + a.map(String).join("|") : ""}`);

    q.select = (_cols?: string, o?: { count?: string; head?: boolean }) => { log("select", _cols ?? "*"); countOnly = Boolean(o?.count && o.head); return q; };
    q.insert = (v: Row | Row[]) => { mode = "insert"; payload = v; log("insert"); return q; };
    q.update = (v: Row) => { mode = "update"; payload = v; log("update", JSON.stringify(v)); return q; };
    q.delete = () => { mode = "delete"; log("delete"); return q; };
    q.eq = (c: string, v: unknown) => { log("eq", c, v); filters.push((r) => r[c] === v); return q; };
    q.neq = (c: string, v: unknown) => { log("neq", c, v); filters.push((r) => r[c] !== v); return q; };
    q.is = (c: string, v: unknown) => { log("is", c, v); filters.push((r) => r[c] === v); return q; };
    q.in = (c: string, vs: unknown[]) => { log("in", c, vs.join(",")); filters.push((r) => vs.includes(r[c])); return q; };
    q.gte = (c: string, v: string) => { log("gte", c, v); filters.push((r) => String(r[c]) >= v); return q; };
    q.gt = (c: string, v: string) => { log("gt", c, v); filters.push((r) => String(r[c]) > v); return q; };
    q.lte = (c: string, v: string) => { log("lte", c, v); filters.push((r) => String(r[c]) <= v); return q; };
    q.lt = (c: string, v: string) => { log("lt", c, v); filters.push((r) => String(r[c]) < v); return q; };
    q.or = (expr: string) => { log("or", expr); filters.push(orFilter(expr)); return q; };
    q.order = (c: string, o?: { ascending?: boolean }) => { log("order", c, o?.ascending ?? true); order.push({ col: c, asc: o?.ascending ?? true }); return q; };
    q.limit = (n: number) => { log("limit", n); limit = n; return q; };

    function matching(): Row[] {
      let out = rows!.filter((r) => filters.every((f) => f(r)));
      for (const o of [...order].reverse()) {
        out = [...out].sort((a, b) => (String(a[o.col]) < String(b[o.col]) ? -1 : String(a[o.col]) > String(b[o.col]) ? 1 : 0) * (o.asc ? 1 : -1));
      }
      if (limit !== null) out = out.slice(0, limit);
      return out;
    }

    function run(): Result {
      if (earlyError) return { data: null, error: earlyError };
      if (mode === "insert") {
        const list = Array.isArray(payload) ? payload : [payload as Row];
        const inserted: Row[] = [];
        for (const v of list) {
          const full = { ...(schema[table]?.defaults?.() ?? {}), ...v };
          const err = violation(table, full, rows!);
          if (err) return { data: null, error: err };
          rows!.push(full);
          inserted.push(full);
        }
        return { data: inserted, error: null };
      }
      if (mode === "update") {
        const targets = matching();
        for (const r of targets) {
          const next = { ...r, ...(payload as Row) };
          const err = violation(table, next, rows!.filter((x) => x !== r));
          if (err) return { data: null, error: err };
        }
        for (const r of targets) Object.assign(r, payload as Row);
        return { data: targets, error: null };
      }
      if (mode === "delete") {
        const targets = matching();
        for (const r of targets) rows!.splice(rows!.indexOf(r), 1);
        return { data: targets, error: null };
      }
      const data = matching();
      return countOnly ? { data: null, error: null, count: data.length } : { data, error: null, count: data.length };
    }

    q.maybeSingle = async (): Promise<Result> => { const r = run(); return r.error ? r : { data: (r.data as Row[])[0] ?? null, error: null }; };
    q.single = async (): Promise<Result> => {
      const r = run();
      if (r.error) return r;
      const first = (r.data as Row[])[0];
      return first ? { data: first, error: null } : { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } };
    };
    q.then = (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve().then(run).then(resolve, reject);
    return q;
  }

  const raw = { from, rpc: async (fn: string, args: Row) => ({ data: opts.rpc ? opts.rpc(fn, args) : null, error: null }) };
  return {
    /** Pass to store functions typed against SupabaseClient. */
    sb: raw as never,
    /** The same client, typed loosely, for tests that query it directly. */
    raw: raw as { from: (table: string) => Record<string, any>; rpc: typeof raw.rpc },
    tables,
    calls,
    rows: (table: string) => tables.get(table) ?? [],
  };
}

/**
 * PostgREST `.or("a.eq.1,b.is.null,and(c.lt.x,d.eq.y)")`: comma-separated
 * clauses with optional `and(...)` groups and eq/neq/is/lt/lte/gt/gte —
 * enough for the cursor filter in lib/apiv1/pagination.ts and the emit query.
 */
function orFilter(expr: string): Filter {
  const clauses = splitTop(expr).map(clauseFilter);
  return (r) => clauses.some((c) => c(r));
}

function clauseFilter(c: string): Filter {
  if (c.startsWith("and(") && c.endsWith(")")) {
    const parts = splitTop(c.slice(4, -1)).map(clauseFilter);
    return (r) => parts.every((p) => p(r));
  }
  const [col, op, ...rest] = c.split(".");
  const raw = rest.join(".");
  const val = raw === "null" ? null : raw;
  return (r: Row) => {
    const v = r[col];
    switch (op) {
      case "eq": case "is": return v === val;
      case "neq": return v !== val;
      case "lt": return String(v) < String(val);
      case "lte": return String(v) <= String(val);
      case "gt": return String(v) > String(val);
      case "gte": return String(v) >= String(val);
      default: throw new Error(`fakeDb: unsupported or() operator ${op}`);
    }
  };
}

/** Split on commas that are not inside parentheses. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (s[i] === "," && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out;
}
