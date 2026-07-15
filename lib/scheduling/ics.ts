import { DateTime } from "luxon";

function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    parts.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return parts.join("\r\n");
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcalUtc(iso: string): string {
  return DateTime.fromISO(iso, { zone: "utc" }).toFormat("yyyyMMdd'T'HHmmss'Z'");
}

export function buildIcs(input: {
  uid: string;
  sequence: number;
  title: string;
  description: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  organizerEmail: string;
  organizerName: string;
  attendeeEmail: string;
  attendeeName: string;
  status?: "CONFIRMED" | "CANCELLED" | "TENTATIVE";
  method?: "REQUEST" | "CANCEL";
  url?: string;
}): string {
  const status = input.status ?? "CONFIRMED";
  const method = input.method ?? (status === "CANCELLED" ? "CANCEL" : "REQUEST");
  const now = DateTime.utc().toFormat("yyyyMMdd'T'HHmmss'Z'");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Redmont Strategies Group//Scheduling//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `SEQUENCE:${input.sequence}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcalUtc(input.startsAt)}`,
    `DTEND:${toIcalUtc(input.endsAt)}`,
    fold(`SUMMARY:${escapeText(input.title)}`),
    fold(`DESCRIPTION:${escapeText(input.description)}`),
    input.location ? fold(`LOCATION:${escapeText(input.location)}`) : null,
    input.url ? fold(`URL:${input.url}`) : null,
    `STATUS:${status}`,
    fold(
      `ORGANIZER;CN=${escapeText(input.organizerName)}:mailto:${input.organizerEmail}`
    ),
    fold(
      `ATTENDEE;CN=${escapeText(input.attendeeName)};RSVP=TRUE:mailto:${input.attendeeEmail}`
    ),
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean) as string[];

  return lines.join("\r\n") + "\r\n";
}

export function googleCalendarUrl(input: {
  title: string;
  description: string;
  location?: string;
  startsAt: string;
  endsAt: string;
}): string {
  const start = DateTime.fromISO(input.startsAt, { zone: "utc" }).toFormat(
    "yyyyMMdd'T'HHmmss'Z'"
  );
  const end = DateTime.fromISO(input.endsAt, { zone: "utc" }).toFormat(
    "yyyyMMdd'T'HHmmss'Z'"
  );
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    details: input.description,
    location: input.location ?? "",
    dates: `${start}/${end}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(input: {
  title: string;
  description: string;
  location?: string;
  startsAt: string;
  endsAt: string;
}): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: input.title,
    body: input.description,
    location: input.location ?? "",
    startdt: input.startsAt,
    enddt: input.endsAt,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function office365CalendarUrl(input: {
  title: string;
  description: string;
  location?: string;
  startsAt: string;
  endsAt: string;
}): string {
  const params = new URLSearchParams({
    subject: input.title,
    body: input.description,
    location: input.location ?? "",
    startdt: input.startsAt,
    enddt: input.endsAt,
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}
