#!/usr/bin/env node
/**
 * Dump integration_runs to NDJSON for offline clustering.
 *
 * The rows come out in exactly the shape the triage clusterer guesses field
 * names for (`ts`, `provider`, `connection_id`, `tenant_id`, `operation`,
 * `outcome`, `error_class`, `error_message`), so no field mapping is needed:
 *
 *   node scripts/export-integration-runs.mjs --hours 24 > runs.ndjson
 *   python3 failure_triage.py runs.ndjson
 *   python3 failure_triage.py runs.ndjson --bucket-minutes 5 --json
 *
 * Read-only. Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
 * environment (or a .env.local this is run alongside).
 *
 * Usage:
 *   --hours N        window to export, counted back from now (default 24)
 *   --provider NAME  restrict to one provider
 *   --failures-only  drop successes — usually what you want mid-incident
 *   --limit N        row cap (default 50000)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

/** Minimal .env.local reader so this works without a dotenv dependency. */
function loadEnvLocal() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env.local — rely on the ambient environment.
  }
}

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

loadEnvLocal();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. " +
      "Run from the project root so .env.local is picked up."
  );
  process.exit(1);
}

const hours = Number(arg("hours", "24"));
const limit = Number(arg("limit", "50000"));
const provider = arg("provider");
const since = new Date(Date.now() - hours * 3_600_000).toISOString();

const sb = createClient(url, key, { auth: { persistSession: false } });

let query = sb
  .from("integration_runs")
  .select(
    "ts, correlation_id, provider, connection_id, tenant_id, operation, " +
      "attempt, status_code, duration_ms, error_class, error_message, " +
      "provider_request_id, outcome"
  )
  .gte("ts", since)
  .order("ts", { ascending: true })
  .limit(limit);

if (provider) query = query.eq("provider", provider);
if (flag("failures-only")) {
  query = query.in("outcome", ["failed", "dead_lettered", "retrying"]);
}

const { data, error } = await query;
if (error) {
  console.error("Export failed:", error.message);
  process.exit(1);
}

for (const row of data ?? []) {
  process.stdout.write(`${JSON.stringify(row)}\n`);
}

// Row count on stderr so it does not pollute the NDJSON on stdout.
console.error(
  `Exported ${data?.length ?? 0} run(s) since ${since}` +
    (data?.length === limit ? ` — HIT THE ${limit} ROW LIMIT, window truncated` : "")
);
