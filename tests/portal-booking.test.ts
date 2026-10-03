/**
 * Client-portal booking bridge: pure row → summary mapping (no I/O).
 * Covers the fix for the portal never surfacing the client's originating
 * consultation (booking.ts's getBookingForLead queries by clients.lead_id).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import * as nodeModule from "node:module";

// ---------------------------------------------------------------------------
// booking.ts imports sibling scheduling modules via the "@/…" tsconfig path
// alias, which plain `node --test` cannot resolve. Register a resolve hook
// that maps "@/x" → "<repo>/x(.ts)" (same pattern as managed-services.test.ts).
// ---------------------------------------------------------------------------

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

const { toPortalBookingSummary } = await import("../lib/scheduling/booking.ts");

describe("toPortalBookingSummary", () => {
  const base = {
    id: "b-1",
    starts_at: "2026-08-20T14:00:00.000Z",
    ends_at: "2026-08-20T14:30:00.000Z",
    status: "confirmed" as const,
    meeting_format: "zoom" as const,
    manage_token: "tok-123",
  };

  it("unwraps object-shaped foreign-table joins", () => {
    const summary = toPortalBookingSummary({
      ...base,
      appointment_types: { name: "Strategy Call" },
      team_members: { name: "Jordan Lee" },
    });
    assert.equal(summary.appointment_type_name, "Strategy Call");
    assert.equal(summary.team_member_name, "Jordan Lee");
    assert.equal(summary.id, "b-1");
    assert.equal(summary.manage_token, "tok-123");
  });

  it("unwraps array-shaped foreign-table joins", () => {
    const summary = toPortalBookingSummary({
      ...base,
      appointment_types: [{ name: "Strategy Call" }],
      team_members: [{ name: "Jordan Lee" }],
    });
    assert.equal(summary.appointment_type_name, "Strategy Call");
    assert.equal(summary.team_member_name, "Jordan Lee");
  });

  it("returns null names when the join is empty", () => {
    const summary = toPortalBookingSummary({
      ...base,
      appointment_types: null,
      team_members: null,
    });
    assert.equal(summary.appointment_type_name, null);
    assert.equal(summary.team_member_name, null);
  });

  it("passes through status, timing, and the manage token unchanged", () => {
    const summary = toPortalBookingSummary({
      ...base,
      status: "rescheduled",
      appointment_types: null,
      team_members: null,
    });
    assert.equal(summary.status, "rescheduled");
    assert.equal(summary.starts_at, base.starts_at);
    assert.equal(summary.ends_at, base.ends_at);
    assert.equal(summary.meeting_format, "zoom");
  });
});
