import { z } from "zod";

const control = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const text = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(control, "").trim())
    .pipe(z.string().max(max));

export const designerConfigSchema = z.object({
  businessType: text(80).pipe(z.string().min(1)),
  systemType: z.enum([
    "internal_assistant",
    "customer_service",
    "phone_assistant",
    "document_processing",
    "operations_automation",
    "reporting",
    "custom_agent",
  ]),
  deployment: z.enum([
    "fully_local",
    "on_premise",
    "private_cloud",
    "hybrid",
    "secure_managed",
  ]),
  dataSources: z.array(text(80)).max(20).default([]),
  privacyControls: z.array(text(80)).max(20).default([]),
});

export const privateAiSubmitSchema = z.object({
  config: designerConfigSchema,
  name: text(120).pipe(z.string().min(1, "Name is required.")),
  businessName: text(160).pipe(z.string().min(1, "Business name is required.")),
  email: text(254).pipe(z.string().email("Enter a valid email address.")),
  phone: text(40).pipe(z.string().min(7, "Enter a valid phone number.")),
  industry: text(80).optional().default(""),
  employees: text(40).optional().default(""),
  locations: text(40).optional().default(""),
  currentSoftware: text(500).optional().default(""),
  privacyConcerns: text(2000).optional().default(""),
  timeline: text(80).optional().default(""),
  notes: text(4000).optional().default(""),
  existingInfrastructure: text(500).optional().default(""),
  dataTypes: text(500).optional().default(""),
  requiredIntegrations: text(500).optional().default(""),
  estimatedUsers: text(40).optional().default(""),
  internetAvailability: text(80).optional().default(""),
  hardwareAvailability: text(80).optional().default(""),
  complianceConsiderations: text(1000).optional().default(""),
  approvalRequirements: text(500).optional().default(""),
  budgetRange: text(80).optional().default(""),
  /** Honeypot */
  company_site: z.string().max(300).optional().default(""),
  elapsedMs: z.number().finite().min(0).max(3_600_000),
  pageUrl: text(300).optional().default(""),
  referrer: text(300).optional().default(""),
  utmSource: text(200).optional().default(""),
  utmMedium: text(200).optional().default(""),
  utmCampaign: text(200).optional().default(""),
});

export type PrivateAiSubmitInput = z.infer<typeof privateAiSubmitSchema>;
