import { z } from "zod";

/**
 * Validation for "Request this system" submissions from the interactive
 * demos. Pure module (no I/O) so it is shared by the API route and unit
 * tests. Mirrors the sanitization used by the booking intake.
 */

const control = new RegExp("[\\u0000-\\u001f\\u007f]", "g");
const clean = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.replace(control, "").trim());

/** Slugs of demos that may submit a request (kept in sync with DEMO_CONFIGS). */
export const DEMO_REQUEST_SLUGS = ["medspa", "contractors", "gyms", "dental", "retail"] as const;

export const demoRequestSchema = z.object({
  name: clean(160).pipe(z.string().min(2, "Please enter your name.")),
  company: clean(160).pipe(z.string().min(1, "Please enter your company name.")),
  email: clean(200).pipe(z.string().email("Enter a valid email address.")),
  phone: clean(40).pipe(
    z.string().regex(/(\d[^\d]*){10,}/, "Enter a valid phone number.")
  ),
  preferredContact: z.enum(["email", "phone", "text"]).default("email"),
  businessSize: clean(40).optional(),
  preferredDate: clean(20).optional(),
  preferredTime: clean(40).optional(),
  notes: clean(2000).optional(),
  /** Services the visitor selected in the form (preselected from usage). */
  services: z.array(clean(80)).max(16).default([]),
  /** Industry-specific qualification answers (e.g. retail business type, locations). */
  extras: z.record(z.string().max(60), clean(160)).optional(),
  demoSlug: z.enum(DEMO_REQUEST_SLUGS),
  /** Feature areas the visitor actually touched during the demo session. */
  featuresExplored: z.array(clean(120)).max(40).default([]),
  scenariosRun: z.number().int().min(0).max(100).optional(),
  /** Business name typed into the demo's personalization, if any. */
  demoBusinessName: clean(160).optional(),
  /** "Biggest operational problem" from the demo's personalization. */
  problem: clean(2000).optional(),
  pageUrl: clean(400).optional(),
  /** Honeypot — humans never see this field; any value means bot. */
  hp: z.string().max(200).optional(),
});

export type DemoRequest = z.infer<typeof demoRequestSchema>;

export const PREFERRED_CONTACT_LABELS: Record<DemoRequest["preferredContact"], string> = {
  email: "Email",
  phone: "Call",
  text: "Text",
};
