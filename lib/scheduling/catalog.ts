import { requireSupabase } from "./db";
import type {
  AppointmentType,
  MeetingFormat,
  QualificationQuestion,
  QualificationRuleSet,
  Service,
  TeamMember,
} from "./types";

function mapAppointmentType(row: Record<string, unknown>): AppointmentType {
  return {
    id: row.id as string,
    name: row.name as string,
    internal_name: row.internal_name as string | null,
    public_description: row.public_description as string | null,
    service_id: row.service_id as string | null,
    slug: row.slug as string,
    duration_minutes: row.duration_minutes as number,
    buffer_before_minutes: (row.buffer_before_minutes as number) ?? 0,
    buffer_after_minutes: (row.buffer_after_minutes as number) ?? 0,
    min_notice_minutes: (row.min_notice_minutes as number) ?? 1440,
    max_advance_days: (row.max_advance_days as number) ?? 60,
    team_member_id: row.team_member_id as string | null,
    meeting_formats: (row.meeting_formats as MeetingFormat[]) ?? ["phone"],
    location: row.location as string | null,
    color: (row.color as string) ?? "#b3243a",
    max_bookings_per_day: row.max_bookings_per_day as number | null,
    max_bookings_per_week: row.max_bookings_per_week as number | null,
    price_cents: row.price_cents as number | null,
    confirmation_message: row.confirmation_message as string | null,
    reminder_offsets_minutes:
      (row.reminder_offsets_minutes as number[]) ?? [0, 1440, 180, 60],
    active: Boolean(row.active),
    is_public: Boolean(row.is_public),
  };
}

export async function listActiveServices(): Promise<Service[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("services")
    .select("*")
    .eq("active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Service[];
}

export async function listPublicAppointmentTypes(): Promise<AppointmentType[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("appointment_types")
    .select("*")
    .eq("active", true)
    .eq("is_public", true)
    .is("deleted_at", null)
    .order("duration_minutes", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapAppointmentType(r as Record<string, unknown>));
}

export async function getAppointmentTypeBySlug(
  slug: string
): Promise<AppointmentType | null> {
  const sb = requireSupabase();
  const { data } = await sb
    .from("appointment_types")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .is("deleted_at", null)
    .maybeSingle();
  return data ? mapAppointmentType(data as Record<string, unknown>) : null;
}

export async function getAppointmentTypeById(
  id: string
): Promise<AppointmentType | null> {
  const sb = requireSupabase();
  const { data } = await sb
    .from("appointment_types")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapAppointmentType(data as Record<string, unknown>) : null;
}

export async function getDefaultTeamMember(): Promise<TeamMember | null> {
  const sb = requireSupabase();
  const { data } = await sb
    .from("team_members")
    .select("*")
    .eq("active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as TeamMember | null;
}

export async function getPublishedQualification() {
  const sb = requireSupabase();
  const { data: form } = await sb
    .from("qualification_forms")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!form) return null;

  const { data: questions } = await sb
    .from("qualification_questions")
    .select("*")
    .eq("form_id", form.id)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const { data: ruleSet } = await sb
    .from("qualification_rule_sets")
    .select("*")
    .eq("form_id", form.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    form,
    questions: (questions ?? []).map((q) => ({
      ...q,
      options: (q.options as string[]) ?? [],
      point_map: (q.point_map as Record<string, number>) ?? {},
      show_when: q.show_when as QualificationQuestion["show_when"],
      service_ids: q.service_ids as string[] | null,
    })) as QualificationQuestion[],
    ruleSet: ruleSet as QualificationRuleSet | null,
  };
}
