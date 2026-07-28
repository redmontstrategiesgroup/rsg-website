/**
 * Data-subject erasure tests. Fully hermetic: a fake Supabase query builder
 * stands in for the DB, so we can assert (a) erasure reaches every PII table,
 * (b) a missing/unmigrated table is skipped rather than aborting the run, and
 * (c) the portal client account is only deleted on explicit opt-in.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eraseDataSubject, exportDataSubject } from "../lib/privacy/erase.ts";

type Result = { data: unknown[] | null; error: { message: string } | null };

/** Records every terminal query and resolves to a per-table configured result. */
function fakeSb(results: Record<string, Result>, log: string[]) {
  const chain = (table: string) => {
    const r = results[table] ?? { data: [], error: null };
    const self: Record<string, unknown> = {};
    for (const m of ["select", "delete", "eq", "in"]) {
      self[m] = (..._args: unknown[]) => self;
    }
    // Thenable: awaiting the chain resolves to the configured result.
    self.then = (resolve: (v: Result) => void) => resolve(r);
    return self;
  };
  return {
    from(table: string) {
      return {
        select: (..._a: unknown[]) => chain(table),
        delete: (..._a: unknown[]) => {
          log.push(`delete:${table}`);
          return chain(table);
        },
      };
    },
  } as never;
}

describe("eraseDataSubject", () => {
  const base = (): Record<string, Result> => ({
    leads: { data: [{ id: "l1" }, { id: "l2" }], error: null },
    bookings: { data: [{ id: "b1" }], error: null },
    subscribers: { data: [{ id: "s1" }], error: null },
    clients: { data: [{ id: "c1" }], error: null },
    // Simulates an unmigrated lifecycle table.
    client_users: { data: null, error: { message: 'relation "client_users" does not exist' } },
  });

  it("erases leads, bookings and subscription by default, WITHOUT touching the client account", async () => {
    const log: string[] = [];
    const sb = fakeSb(base(), log);
    const { outcomes, clientAccountPresent } = await eraseDataSubject(sb, "person@example.com");

    const ok = Object.fromEntries(outcomes.map((o) => [o.table, o]));
    assert.equal(ok.leads.status, "ok");
    assert.equal(ok.leads.deleted, 2);
    assert.equal(ok.bookings.status, "ok");
    assert.equal(ok.subscribers.status, "ok");
    // The account exists but must NOT be deleted without opt-in.
    assert.equal(clientAccountPresent, true);
    assert.ok(!log.includes("delete:clients"), "clients must not be deleted by default");
    assert.ok(!log.includes("delete:client_users"), "client_users must not be deleted by default");
  });

  it("erases the client account only when includeClientAccount is true", async () => {
    const log: string[] = [];
    const sb = fakeSb(base(), log);
    const { outcomes } = await eraseDataSubject(sb, "person@example.com", {
      includeClientAccount: true,
    });
    assert.ok(log.includes("delete:clients"), "clients should be deleted on opt-in");
    // The unmigrated client_users table is skipped, not fatal.
    const cu = outcomes.find((o) => o.table === "client_users");
    assert.equal(cu?.status, "skipped");
    // And the rest still succeeded despite that skip.
    assert.equal(outcomes.find((o) => o.table === "clients")?.status, "ok");
  });

  it("a table error is reported as skipped, never thrown", async () => {
    const results = base();
    results.subscribers = { data: null, error: { message: "boom" } };
    const log: string[] = [];
    const sb = fakeSb(results, log);
    const { outcomes } = await eraseDataSubject(sb, "person@example.com");
    assert.equal(outcomes.find((o) => o.table === "subscribers")?.status, "skipped");
  });
});

describe("exportDataSubject", () => {
  it("returns the full footprint scoped to one email", async () => {
    const results: Record<string, Result> = {
      leads: { data: [{ id: "l1", email: "p@x.com" }], error: null },
      bookings: { data: [{ id: "b1", lead_id: "l1" }], error: null },
      subscribers: { data: [{ id: "s1" }], error: null },
      clients: { data: [{ id: "c1", email: "p@x.com" }], error: null },
      client_users: { data: [], error: null },
    };
    const sb = fakeSb(results, []);
    const out = await exportDataSubject(sb, "p@x.com");
    assert.equal(out.email, "p@x.com");
    assert.equal(out.leads.length, 1);
    assert.equal(out.bookings.length, 1);
    assert.equal(out.clientAccount.length, 1);
    assert.ok(out.exportedAt);
  });
});
