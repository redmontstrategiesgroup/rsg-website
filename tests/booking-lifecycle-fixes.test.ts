/**
 * Regressions found by the 2026-09-27 live end-to-end pass over booking,
 * email, and cookie analytics. Pure functions only (no I/O).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import * as nodeModule from "node:module";

// Map the "@/…" tsconfig alias for plain `node --test` (same hook as
// portal-booking.test.ts).
type ResolveHook = (
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context?: unknown) => unknown
) => unknown;

const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    let spec = specifier;
    if (spec.startsWith("@/")) {
      spec = pathToFileURL(path.join(repoRoot, spec.slice(2))).href;
    }
    try {
      return nextResolve(spec, context);
    } catch (err) {
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        try {
          return nextResolve(`${spec}${suffix}`, context);
        } catch {
          /* try the next candidate */
        }
      }
      throw err;
    }
  },
});

const { sessionContactName } = await import("../lib/scheduling/intake-schema.ts");
const { runBookingId } = await import("../lib/lifecycle/automations.ts");
const { rowToPageView } = await import("../lib/store.ts");

describe("sessionContactName", () => {
  it("joins the first and last name a booking session stores", () => {
    // The lifecycle hook read contact.name, which sessions never set, so the
    // questionnaire invite greeted every visitor as "there".
    assert.equal(
      sessionContactName({ firstName: "Ada", lastName: "Lovelace" }),
      "Ada Lovelace"
    );
  });

  it("works with a first name only", () => {
    assert.equal(sessionContactName({ firstName: "Ada", lastName: "" }), "Ada");
  });

  it("falls back to a legacy single name field", () => {
    assert.equal(sessionContactName({ name: "Grace Hopper" }), "Grace Hopper");
  });

  it("returns empty for a missing contact", () => {
    assert.equal(sessionContactName(null), "");
    assert.equal(sessionContactName({}), "");
  });
});

describe("runBookingId", () => {
  it("reads the booking a visitor email run belongs to", () => {
    assert.equal(
      runBookingId({ payload: { email: { to: "a@b.co", bookingId: "bk-1", vars: {} } } }),
      "bk-1"
    );
  });

  it("is null for runs not tied to a booking", () => {
    assert.equal(runBookingId({ payload: { email: { to: "a@b.co", vars: {} } } }), null);
    assert.equal(runBookingId({ payload: {} }), null);
    assert.equal(runBookingId({ payload: null }), null);
  });
});

describe("rowToPageView", () => {
  it("maps a page_views row to the admin analytics shape", () => {
    assert.deepEqual(
      rowToPageView({
        vid: "v1",
        path: "/pricing",
        referrer: null,
        viewed_at: "2026-09-27T05:00:00+00:00",
      }),
      { vid: "v1", path: "/pricing", referrer: "", at: "2026-09-27T05:00:00+00:00" }
    );
  });
});
