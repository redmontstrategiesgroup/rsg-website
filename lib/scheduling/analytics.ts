import { requireSupabase } from "./db";

export async function trackSchedulingEvent(input: {
  eventType: string;
  sessionId?: string;
  leadId?: string;
  bookingId?: string;
  serviceId?: string;
  appointmentTypeId?: string;
  meta?: Record<string, unknown>;
  isTest?: boolean;
}) {
  if (input.isTest) {
    // Still store but flagged — excluded from production analytics queries
  }
  try {
    const sb = requireSupabase();
    await sb.from("scheduling_analytics_events").insert({
      event_type: input.eventType,
      session_id: input.sessionId ?? null,
      lead_id: input.leadId ?? null,
      booking_id: input.bookingId ?? null,
      service_id: input.serviceId ?? null,
      appointment_type_id: input.appointmentTypeId ?? null,
      meta: input.meta ?? {},
      is_test: input.isTest ?? false,
    });
  } catch (err) {
    console.error("[scheduling] analytics event failed", err);
  }
}

export async function logActivity(input: {
  entityType: string;
  entityId?: string;
  leadId?: string;
  bookingId?: string;
  action: string;
  actor?: string;
  detail?: Record<string, unknown>;
}) {
  try {
    const sb = requireSupabase();
    await sb.from("scheduling_activity_logs").insert({
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      lead_id: input.leadId ?? null,
      booking_id: input.bookingId ?? null,
      action: input.action,
      actor: input.actor ?? "system",
      detail: input.detail ?? {},
    });
  } catch (err) {
    console.error("[scheduling] activity log failed", err);
  }
}
