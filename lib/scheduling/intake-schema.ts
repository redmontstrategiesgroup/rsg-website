import { z } from "zod";

/**
 * Validation for the simplified booking intake. Pure module (no I/O) so it is
 * shared by the API route, the intake flow, and unit tests.
 */

const control = /[\u0000-\u001f\u007f]/g;
const clean = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.replace(control, "").trim());

export const intakeContactSchema = z.object({
  fullName: clean(160).pipe(z.string().min(2, "Please enter your name.")),
  businessName: clean(160).pipe(
    z.string().min(1, "Please enter your business name.")
  ),
  email: clean(200).pipe(z.string().email("Enter a valid email address.")),
  phone: clean(40).pipe(
    z.string().regex(/(\d[^\d]*){10,}/, "Enter a valid phone number.")
  ),
  industry: clean(120).optional().default(""),
  website: clean(300).optional().default(""),
  preferredContact: z.enum(["email", "phone", "text"]).default("email"),
});

/** Optional ongoing support & management questions (managed services). */
export const servicePlanAnswersSchema = z.object({
  hasMaintainer: z.enum(["yes", "no", "partially"]).optional(),
  ongoingNeeds: z
    .enum(["maintenance_only", "occasional_changes", "ongoing_improvements"])
    .optional(),
  automationInterest: z.enum(["yes", "maybe", "no"]).optional(),
  aiManagement: z.enum(["yes", "planning_to", "no"]).optional(),
  sensitiveData: z.enum(["yes", "no", "unsure"]).optional(),
  supportSpeed: z.enum(["same_day", "next_day", "within_days"]).optional(),
  billingPreference: z.enum(["monthly", "annual", "undecided"]).optional(),
});

export const intakeAnswersSchema = z
  .object({
    /** "What would you most like help improving?" (optional short answer) */
    problem: clean(2000).optional(),
    /** "What is the biggest result you are trying to achieve?" (optional) */
    result: clean(120).optional(),
    business_size: clean(40).optional(),
    current_challenge: clean(2000).optional(),
    interested_services: z.array(clean(80)).max(12).optional(),
    private_ai_focus: z.array(clean(120)).max(12).optional(),
    current_tools: clean(500).optional(),
    /** Ongoing support & management (optional managed-services questions). */
    servicePlan: servicePlanAnswersSchema.optional(),
  })
  .default({});

export type IntakeContact = z.infer<typeof intakeContactSchema>;
export type IntakeAnswers = z.infer<typeof intakeAnswersSchema>;

export function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}
