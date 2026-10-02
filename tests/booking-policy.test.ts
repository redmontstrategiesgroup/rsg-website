/**
 * Hard booking policy (lib/scheduling/policy.ts): Tue–Thu only, 9am–4pm,
 * starts every 30 minutes,
 * max 2 per day, 1h between bookings, 24h notice, no same-day bookings.
 * Pure slot generation only (no I/O).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { DateTime } from "luxon";

// Resolve extensionless relative imports for plain `node --test`.
type ResolveHook = (
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context?: unknown) => unknown
) => unknown;
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      for (const suffix of [".ts", "/index.ts"]) {
        try {
          return nextResolve(`${specifier}${suffix}`, context);
        } catch {
          /* try the next candidate */
        }
      }
      throw err;
    }
  },
});

const { generateSlots } = await import("../lib/scheduling/availability.ts");
const { BOOKING_POLICY } = await import("../lib/scheduling/policy.ts");

const TZ = "America/New_York";
const et = (iso: string) => DateTime.fromISO(iso, { zone: TZ });

// Mon–Fri 09:00–17:00 — wider than the policy, so the policy must clamp it.
const weekdayWindows = [1, 2, 3, 4, 5].map((d) => ({
  day_of_week: d,
  specific_date: null,
  start_time: "09:00:00",
  end_time: "17:00:00",
}));

// Week of Mon 2026-10-05 .. Sun 2026-10-11.
function slots(opts: {
  now: string;
  existing?: { starts_at: string; ends_at: string; status: string }[];
  minNoticeMinutes?: number;
  policy?: typeof BOOKING_POLICY;
}) {
  return generateSlots({
    rangeStart: et("2026-10-05T00:00").toJSDate(),
    rangeEnd: et("2026-10-11T23:59").toJSDate(),
    durationMinutes: 45,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 15,
    minNoticeMinutes: opts.minNoticeMinutes ?? 120,
    maxAdvanceDays: 60,
    scheduleTimezone: TZ,
    visitorTimezone: TZ,
    windows: weekdayWindows,
    blocks: [],
    existing: opts.existing ?? [],
    now: et(opts.now).toJSDate(),
    policy: opts.policy,
  }).map((s) => ({
    start: DateTime.fromISO(s.start).setZone(TZ),
    end: DateTime.fromISO(s.end).setZone(TZ),
  }));
}

const booking = (start: string, end: string) => ({
  starts_at: et(start).toUTC().toISO()!,
  ends_at: et(end).toUTC().toISO()!,
  status: "confirmed",
});

describe("booking policy", () => {
  it("only offers Tuesday, Wednesday and Thursday", () => {
    const days = new Set(slots({ now: "2026-10-01T12:00" }).map((s) => s.start.weekday));
    assert.deepEqual([...days].sort(), [2, 3, 4]); // luxon Tue=2, Wed=3, Thu=4
  });

  it("keeps every meeting inside 9am–4pm", () => {
    const all = slots({ now: "2026-10-01T12:00" });
    assert.ok(all.length > 0);
    for (const s of all) {
      assert.ok(s.start >= s.start.set({ hour: 9, minute: 0 }), s.start.toISO()!);
      assert.ok(s.end <= s.start.set({ hour: 16, minute: 0 }), s.end.toISO()!);
    }
  });

  it("requires 24 hours notice even if the type allows less", () => {
    const now = et("2026-10-06T10:00"); // Tuesday 10am
    const all = slots({ now: now.toISO()!, minNoticeMinutes: 0 });
    assert.ok(all.length > 0);
    for (const s of all) assert.ok(s.start >= now.plus({ hours: 24 }), s.start.toISO()!);
  });

  it("never offers same-day slots", () => {
    const all = slots({
      now: "2026-10-06T06:00", // Tuesday 6am, before the day opens
      policy: { ...BOOKING_POLICY, minNoticeMinutes: 0 },
      minNoticeMinutes: 0,
    });
    assert.ok(all.length > 0);
    assert.ok(all.every((s) => s.start.toISODate() !== "2026-10-06"));
  });

  it("caps each day at 2 bookings without hiding open slots", () => {
    const wed = (all: ReturnType<typeof slots>) =>
      all.filter((s) => s.start.toISODate() === "2026-10-07");

    const one = slots({
      now: "2026-10-01T12:00",
      existing: [booking("2026-10-07T09:00", "2026-10-07T09:45")],
    });
    assert.ok(wed(one).length > 1, "one booking leaves several choices open");

    const two = slots({
      now: "2026-10-01T12:00",
      existing: [
        booking("2026-10-07T09:00", "2026-10-07T09:45"),
        booking("2026-10-07T14:00", "2026-10-07T14:45"),
      ],
    });
    assert.equal(wed(two).length, 0);
  });

  it("leaves at least an hour between bookings", () => {
    const all = slots({
      now: "2026-10-01T12:00",
      existing: [booking("2026-10-07T11:00", "2026-10-07T11:45")],
    }).filter((s) => s.start.toISODate() === "2026-10-07");
    assert.ok(all.length > 0);
    for (const s of all) {
      const clear =
        s.end <= et("2026-10-07T10:00") || s.start >= et("2026-10-07T12:45");
      assert.ok(clear, `${s.start.toFormat("HH:mm")}–${s.end.toFormat("HH:mm")}`);
    }
  });
  it("starts meetings on the half hour, whatever the duration", () => {
    const tue = slots({ now: "2026-10-01T12:00" }).filter(
      (s) => s.start.toISODate() === "2026-10-06"
    );
    assert.deepEqual(
      tue.slice(0, 4).map((s) => s.start.toFormat("HH:mm")),
      ["09:00", "09:30", "10:00", "10:30"]
    );
    for (const s of tue) assert.ok(s.start.minute % 30 === 0, s.start.toISO()!);
  });
});
