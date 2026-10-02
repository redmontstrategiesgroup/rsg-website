/**
 * Hard booking rules that apply to every appointment type, in the schedule
 * timezone. Admin-configured windows, notice, and caps can only tighten these,
 * never loosen them — the slot generator takes the stricter of the two.
 */
export const BOOKING_POLICY = {
  /** 0=Sun..6=Sat. Tuesday, Wednesday, Thursday. */
  allowedDays: [2, 3, 4] as readonly number[],
  /** Meetings must start at or after this time and end by `dayEnd`. */
  dayStart: "09:00",
  dayEnd: "16:00",
  /** Start times fall on this grid (from midnight): :00 and :30. */
  slotIntervalMinutes: 30,
  maxPerDay: 2,
  /** Minimum gap between the end of one booking and the start of the next. */
  minGapMinutes: 60,
  minNoticeMinutes: 24 * 60,
  /** Never offer a slot on the current calendar day. */
  noSameDay: true,
};

export type BookingPolicy = typeof BOOKING_POLICY;
