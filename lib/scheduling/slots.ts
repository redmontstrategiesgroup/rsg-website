import { DateTime } from "luxon";
import { generateSlots } from "./availability";
import { requireSupabase, adminTimezone } from "./db";
import { getAppointmentTypeById, getDefaultTeamMember } from "./catalog";
import { getSettings } from "./notifications";

export async function getAvailableSlots(input: {
  appointmentTypeId: string;
  from: string; // ISO date
  to: string;
  visitorTimezone: string;
  teamMemberId?: string;
}): Promise<{ start: string; end: string; label: string }[]> {
  const settings = await getSettings();
  if (settings.bookings_paused) return [];

  const type = await getAppointmentTypeById(input.appointmentTypeId);
  if (!type || !type.active) return [];

  const member =
    (input.teamMemberId
      ? await requireSupabase()
          .from("team_members")
          .select("*")
          .eq("id", input.teamMemberId)
          .maybeSingle()
          .then((r) => r.data)
      : null) ?? (await getDefaultTeamMember());

  if (!member) return [];

  const memberId = (member as { id: string }).id;
  const scheduleTz =
    (member as { timezone?: string }).timezone || adminTimezone();

  const sb = requireSupabase();
  const { data: schedules } = await sb
    .from("availability_schedules")
    .select("id, timezone, paused, active")
    .eq("team_member_id", memberId)
    .eq("active", true);

  const activeSchedules = (schedules ?? []).filter((s) => !s.paused);
  if (!activeSchedules.length) return [];

  const scheduleIds = activeSchedules.map((s) => s.id);
  const { data: windows } = await sb
    .from("availability_windows")
    .select("*")
    .in("schedule_id", scheduleIds);

  const rangeStart = DateTime.fromISO(input.from, { zone: scheduleTz }).startOf(
    "day"
  );
  const rangeEnd = DateTime.fromISO(input.to, { zone: scheduleTz }).endOf("day");

  const { data: blocks } = await sb
    .from("calendar_blocks")
    .select("starts_at, ends_at")
    .eq("team_member_id", memberId)
    .lt("starts_at", rangeEnd.toUTC().toISO()!)
    .gt("ends_at", rangeStart.toUTC().toISO()!);

  const { data: existing } = await sb
    .from("bookings")
    .select("starts_at, ends_at, status")
    .eq("team_member_id", memberId)
    .in("status", ["confirmed", "rescheduled"])
    .lt("starts_at", rangeEnd.toUTC().toISO()!)
    .gt("ends_at", rangeStart.toUTC().toISO()!);

  return generateSlots({
    rangeStart: rangeStart.toJSDate(),
    rangeEnd: rangeEnd.toJSDate(),
    durationMinutes: type.duration_minutes,
    bufferBeforeMinutes: type.buffer_before_minutes,
    bufferAfterMinutes: type.buffer_after_minutes,
    minNoticeMinutes: type.min_notice_minutes,
    maxAdvanceDays: type.max_advance_days,
    scheduleTimezone: activeSchedules[0]?.timezone || scheduleTz,
    visitorTimezone: input.visitorTimezone,
    windows: (windows ?? []).map((w) => ({
      day_of_week: w.day_of_week,
      specific_date: w.specific_date,
      start_time: String(w.start_time).slice(0, 8),
      end_time: String(w.end_time).slice(0, 8),
    })),
    blocks: blocks ?? [],
    existing: existing ?? [],
    maxPerDay: type.max_bookings_per_day,
    maxPerWeek: type.max_bookings_per_week,
  });
}

/** Recheck a single slot is still free (race-condition guard). */
export async function isSlotAvailable(input: {
  appointmentTypeId: string;
  teamMemberId: string;
  startsAt: string;
  endsAt: string;
}): Promise<boolean> {
  const type = await getAppointmentTypeById(input.appointmentTypeId);
  if (!type) return false;

  const visitorTz = "UTC";
  const day = DateTime.fromISO(input.startsAt, { zone: "utc" }).toISODate()!;
  const slots = await getAvailableSlots({
    appointmentTypeId: input.appointmentTypeId,
    from: day,
    to: day,
    visitorTimezone: visitorTz,
    teamMemberId: input.teamMemberId,
  });

  return slots.some((s) => {
    const a = DateTime.fromISO(s.start, { zone: "utc" }).toMillis();
    const b = DateTime.fromISO(input.startsAt, { zone: "utc" }).toMillis();
    return a === b;
  });
}
