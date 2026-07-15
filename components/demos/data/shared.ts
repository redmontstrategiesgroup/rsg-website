import type {
  AppointmentType,
  IntakeField,
  RoleConfig,
  StaffMember,
  Template,
  Terminology,
} from "../types";
import { DEFAULT_ROLES, DEFAULT_TERMINOLOGY } from "../defaults";

/** Shared stubs so industry demo configs satisfy IndustryConfig without duplication. */
export const DEMO_STAFF: StaffMember[] = [
  { id: "staff-1", name: "Alex Rivera", role: "Owner" },
  { id: "staff-2", name: "Jordan Lee", role: "Coordinator" },
];

export const DEMO_ROLES: RoleConfig[] = DEFAULT_ROLES;

export const DEMO_TERMINOLOGY: Terminology = DEFAULT_TERMINOLOGY;

export const DEMO_TEMPLATES: Template[] = [
  {
    id: "tpl-default",
    name: "Quick reply",
    channel: "sms",
    tone: "professional",
    text: "Hi {first_name}, thanks for reaching out to {business_name}. How can we help with {service}?",
  },
];

export const DEMO_INTAKE_FIELDS: IntakeField[] = [
  { id: "name", label: "Full name", type: "text", required: true },
  { id: "phone", label: "Phone", type: "phone", required: true },
  { id: "email", label: "Email", type: "email" },
  { id: "service", label: "Service interest", type: "text", required: true },
  { id: "notes", label: "Notes", type: "textarea" },
];

export const DEMO_APPOINTMENT_TYPES: AppointmentType[] = [
  { id: "apt-consult", label: "Consultation", duration: 30 },
  { id: "apt-service", label: "Service appointment", duration: 60 },
];

export const DEMO_SCHEDULE_DAYS = [
  { day: "Mon", date: "Jul 14" },
  { day: "Tue", date: "Jul 15" },
  { day: "Wed", date: "Jul 16" },
  { day: "Thu", date: "Jul 17" },
  { day: "Fri", date: "Jul 18" },
];

export const DEMO_SAMPLE_CUSTOMER: Record<string, string> = {
  first_name: "Alex",
  service: "Consultation",
  appointment_date: "Tuesday, Jul 15",
  appointment_time: "10:00 AM",
  estimate_amount: "$1,200",
};
