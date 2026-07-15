import { DateTime } from "luxon";
import { randomUUID } from "node:crypto";
import { requireSupabase } from "./db";
import { createSecureToken } from "./tokens";
import type { Attribution, ContactInfo } from "./types";
import { trackSchedulingEvent, logActivity } from "./analytics";

const SESSION_TTL_HOURS = 72;

export async function createBookingSession(input: {
  attribution?: Attribution;
  isTest?: boolean;
  serviceId?: string;
  appointmentTypeId?: string;
  timezone?: string;
}) {
  const sb = requireSupabase();
  const id = randomUUID();
  const token = createSecureToken(32);
  const expiresAt = DateTime.utc().plus({ hours: SESSION_TTL_HOURS }).toISO()!;

  const { error } = await sb.from("booking_sessions").insert({
    id,
    token,
    step: "service",
    service_id: input.serviceId ?? null,
    appointment_type_id: input.appointmentTypeId ?? null,
    contact: {},
    answers: {},
    attribution: input.attribution ?? {},
    timezone: input.timezone ?? null,
    is_test: input.isTest ?? false,
    expires_at: expiresAt,
  });
  if (error) throw error;

  await trackSchedulingEvent({
    eventType: "intake_started",
    sessionId: id,
    serviceId: input.serviceId,
    appointmentTypeId: input.appointmentTypeId,
    isTest: input.isTest,
  });

  return { id, token, expiresAt };
}

export async function getSessionByToken(token: string) {
  const sb = requireSupabase();
  const { data } = await sb
    .from("booking_sessions")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return data;
}

export async function patchBookingSession(
  token: string,
  patch: {
    step?: string;
    serviceId?: string | null;
    appointmentTypeId?: string | null;
    contact?: Partial<ContactInfo>;
    answers?: Record<string, unknown>;
    timezone?: string;
    meetingFormat?: string;
  }
) {
  const session = await getSessionByToken(token);
  if (!session) return null;

  const sb = requireSupabase();
  const nextContact = {
    ...(session.contact as object),
    ...(patch.contact ?? {}),
  };
  const nextAnswers = {
    ...(session.answers as object),
    ...(patch.answers ?? {}),
  };

  const { data, error } = await sb
    .from("booking_sessions")
    .update({
      step: patch.step ?? session.step,
      service_id:
        patch.serviceId !== undefined ? patch.serviceId : session.service_id,
      appointment_type_id:
        patch.appointmentTypeId !== undefined
          ? patch.appointmentTypeId
          : session.appointment_type_id,
      contact: nextContact,
      answers: nextAnswers,
      timezone: patch.timezone ?? session.timezone,
      meeting_format: patch.meetingFormat ?? session.meeting_format,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .select("*")
    .single();

  if (error) throw error;
  await logActivity({
    entityType: "session",
    entityId: session.id,
    action: "session_patched",
    detail: { step: patch.step },
  });
  return data;
}
