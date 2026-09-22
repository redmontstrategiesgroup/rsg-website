import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API_PLATFORM_SCHEMA } from "./_fake-db.ts";

/**
 * The fake is only worth having if its constraints are the migrations'
 * constraints. This reads every migration and checks the specific facts
 * `API_PLATFORM_SCHEMA` encodes — so adding a unique index to a migration
 * without teaching the fake (or vice versa) fails here, not in production.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "supabase", "migrations");
const sql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(dir, f), "utf8").replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase())
  .join("\n");

const has = (re: RegExp) => re.test(sql);

describe("fake-db schema mirrors supabase/migrations", () => {
  it("api_keys: key_hash unique, principal_type check, name length check", () => {
    assert.ok(has(/key_hash text not null unique/));
    assert.ok(has(/principal_type text not null check \(principal_type in \('client','admin'\)\)/));
    assert.ok(has(/name text not null check \(char_length\(name\) between 1 and 80\)/));
    assert.deepEqual(API_PLATFORM_SCHEMA.api_keys.unique?.map((u) => u.columns), [["key_hash"]]);
    assert.deepEqual(API_PLATFORM_SCHEMA.api_keys.checks?.principal_type, ["client", "admin"]);
  });
  it("api_idempotency: composite pk and status check", () => {
    assert.ok(has(/primary key \(principal_id, key\)/));
    assert.ok(has(/status text not null check \(status in \('in_flight','done'\)\)/));
    assert.deepEqual(API_PLATFORM_SCHEMA.api_idempotency.pk, ["principal_id", "key"]);
    assert.deepEqual(API_PLATFORM_SCHEMA.api_idempotency.checks?.status, ["in_flight", "done"]);
  });
  it("webhook_endpoints: kind and owner_type checks", () => {
    assert.ok(has(/webhook_endpoints_kind_check check \(kind in \('client', 'registry'\)\)/));
    assert.ok(has(/owner_type text check \(owner_type in \('client','admin'\)\)/));
    assert.deepEqual(API_PLATFORM_SCHEMA.webhook_endpoints.checks?.kind, ["client", "registry"]);
  });
  it("webhook_deliveries: per-endpoint partial unique, status check, and the global idempotency index is dropped", () => {
    assert.ok(has(/webhook_deliveries_event_uniq on public\.webhook_deliveries \(endpoint_id, event_id\) where event_id is not null/));
    assert.ok(has(/webhook_deliveries_status_check check \(status in \( 'pending', 'sending', 'delivered', 'failed', 'dead' \)\)/));
    assert.ok(has(/create unique index if not exists webhook_deliveries_idempotency_uidx/), "the old index was created…");
    assert.ok(has(/drop index if exists public\.webhook_deliveries_idempotency_uidx/), "…and must be dropped by a later migration");
    const u = API_PLATFORM_SCHEMA.webhook_deliveries.unique ?? [];
    assert.deepEqual(u.map((x) => x.columns), [["endpoint_id", "event_id"]]);
    assert.ok(u[0]!.where, "partial index needs its predicate");
    assert.deepEqual(API_PLATFORM_SCHEMA.webhook_deliveries.checks?.status, ["pending", "sending", "delivered", "failed", "dead"]);
  });
});
