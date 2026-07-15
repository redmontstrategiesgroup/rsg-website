import { DateTime } from "luxon";

export type AvailabilityWindowRow = {
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string; // HH:mm:ss or HH:mm
  end_time: string;
};

export type CalendarBlockRow = {
  starts_at: string;
  ends_at: string;
};

export type ExistingBookingRow = {
  starts_at: string;
  ends_at: string;
  status: string;
};

function parseTimeOnDate(
  dateISO: string,
  time: string,
  zone: string
): DateTime {
  const t = time.length === 5 ? `${time}:00` : time;
  return DateTime.fromISO(`${dateISO}T${t}`, { zone });
}

/**
 * Generate available UTC slot starts for a date range in the schedule timezone,
 * then convert labels to the visitor timezone.
 */
export function generateSlots(input: {
  rangeStart: Date; // UTC instant
  rangeEnd: Date;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  scheduleTimezone: string;
  visitorTimezone: string;
  windows: AvailabilityWindowRow[];
  blocks: CalendarBlockRow[];
  existing: ExistingBookingRow[];
  maxPerDay?: number | null;
  maxPerWeek?: number | null;
  now?: Date;
}): { start: string; end: string; label: string }[] {
  const now = DateTime.fromJSDate(input.now ?? new Date()).toUTC();
  const minStart = now.plus({ minutes: input.minNoticeMinutes });
  const maxStart = now.plus({ days: input.maxAdvanceDays });

  const rangeStart = DateTime.fromJSDate(input.rangeStart).setZone(input.scheduleTimezone).startOf("day");
  const rangeEnd = DateTime.fromJSDate(input.rangeEnd).setZone(input.scheduleTimezone).endOf("day");

  const slots: { start: string; end: string; label: string }[] = [];
  const dayCounts = new Map<string, number>();
  const weekCounts = new Map<string, number>();

  // Seed counts from existing bookings
  for (const b of input.existing) {
    if (b.status === "cancelled") continue;
    const s = DateTime.fromISO(b.starts_at, { zone: input.scheduleTimezone });
    const dayKey = s.toISODate()!;
    const weekKey = `${s.weekYear}-W${s.weekNumber}`;
    dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1);
    weekCounts.set(weekKey, (weekCounts.get(weekKey) ?? 0) + 1);
  }

  let cursor = rangeStart;
  while (cursor <= rangeEnd) {
    const dateISO = cursor.toISODate()!;
    const dow = cursor.weekday % 7; // luxon: Mon=1..Sun=7 → convert to 0=Sun

    const dayWindows = input.windows.filter((w) => {
      if (w.specific_date) return w.specific_date === dateISO;
      return w.day_of_week === dow;
    });

    // Date-specific windows replace weekly if any exist for that date
    const specific = dayWindows.filter((w) => w.specific_date);
    const applicable = specific.length > 0 ? specific : dayWindows.filter((w) => w.day_of_week != null);

    for (const win of applicable) {
      let slotStart = parseTimeOnDate(dateISO, win.start_time, input.scheduleTimezone);
      const winEnd = parseTimeOnDate(dateISO, win.end_time, input.scheduleTimezone);

      while (
        slotStart.plus({ minutes: input.durationMinutes }) <= winEnd
      ) {
        const slotEnd = slotStart.plus({ minutes: input.durationMinutes });
        const occupiedStart = slotStart.minus({ minutes: input.bufferBeforeMinutes });
        const occupiedEnd = slotEnd.plus({ minutes: input.bufferAfterMinutes });

        const startUTC = slotStart.toUTC();
        if (startUTC < minStart || startUTC > maxStart) {
          slotStart = slotStart.plus({ minutes: input.durationMinutes });
          continue;
        }

        const overlapsBlock = input.blocks.some((b) => {
          const bs = DateTime.fromISO(b.starts_at);
          const be = DateTime.fromISO(b.ends_at);
          return occupiedStart < be && occupiedEnd > bs;
        });

        const overlapsBooking = input.existing.some((b) => {
          if (b.status === "cancelled") return false;
          const bs = DateTime.fromISO(b.starts_at);
          const be = DateTime.fromISO(b.ends_at);
          return occupiedStart < be && occupiedEnd > bs;
        });

        const dayKey = dateISO;
        const weekKey = `${slotStart.weekYear}-W${slotStart.weekNumber}`;
        const dayCount = dayCounts.get(dayKey) ?? 0;
        const weekCount = weekCounts.get(weekKey) ?? 0;
        const dayOk =
          input.maxPerDay == null || dayCount < input.maxPerDay;
        const weekOk =
          input.maxPerWeek == null || weekCount < input.maxPerWeek;

        if (!overlapsBlock && !overlapsBooking && dayOk && weekOk) {
          const visitorLocal = startUTC.setZone(input.visitorTimezone);
          slots.push({
            start: startUTC.toISO()!,
            end: slotEnd.toUTC().toISO()!,
            label: visitorLocal.toFormat("h:mm a"),
          });
          dayCounts.set(dayKey, dayCount + 1);
          weekCounts.set(weekKey, weekCount + 1);
        }

        slotStart = slotStart.plus({ minutes: input.durationMinutes });
      }
    }

    cursor = cursor.plus({ days: 1 }).startOf("day");
  }

  return slots;
}

export function formatInZone(
  isoUtc: string,
  zone: string,
  fmt = "cccc, LLL d · h:mm a ZZZZ"
): string {
  return DateTime.fromISO(isoUtc, { zone: "utc" }).setZone(zone).toFormat(fmt);
}
