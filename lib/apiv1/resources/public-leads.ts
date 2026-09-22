// lib/apiv1/resources/public-leads.ts
import { z } from "zod";
import { processLead } from "@/lib/leads";
import type { Lead } from "@/lib/types";
import type { ApiHandler } from "../types.ts";

export const createBody = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email().max(200),
  company: z.string().max(160).default(""),
  phone: z.string().max(40).default(""),
  message: z.string().max(4000).default(""),
  source: z.string().max(60).default("api_public"),
  // Honeypot: any non-empty value here means a bot filled the field a
  // real visitor never sees. Silently accept rather than reject — a
  // validation error would tell the bot it was detected.
  website_url: z.string().max(500).optional(),
  attribution: z
    .object({
      page_url: z.string().max(500).optional(),
      referrer: z.string().max(500).optional(),
      utm_source: z.string().max(200).optional(),
      utm_medium: z.string().max(200).optional(),
      utm_campaign: z.string().max(200).optional(),
    })
    .optional(),
}).meta({
  example: {
    name: "Dana Whitfield",
    email: "dana@northshoredental.com",
    company: "Northshore Dental",
    phone: "+1 555 010 0199",
    message: "We need help getting more new-patient bookings.",
    attribution: { page_url: "https://example.com/pricing", utm_source: "partner" },
  },
});

export const submitLead: ApiHandler<z.infer<typeof createBody>, undefined> = async ({ body }) => {
  if (body.website_url) {
    return { status: 202, data: { accepted: true } };
  }

  const attribution = body.attribution;
  const lead: Lead = {
    name: body.name,
    company: body.company,
    email: body.email,
    phone: body.phone,
    website: "",
    industry: "",
    problem: body.message,
    improve: "",
    submittedAt: new Date().toISOString(),
    source: body.source,
    status: "new",
    pageUrl: attribution?.page_url,
    referrer: attribution?.referrer,
    utmSource: attribution?.utm_source,
    utmMedium: attribution?.utm_medium,
    utmCampaign: attribution?.utm_campaign,
  };

  // Unlike the admin create, do not 503 when storedInDatabase is false: an
  // anonymous submitter cannot act on that signal, and processLead has
  // other sinks (email, local/remote fallback stores). 202 + accepted:true
  // is the honest response regardless of which sink actually persisted it.
  const result = await processLead(lead);
  return { status: 202, data: { accepted: true, duplicate: result.duplicate } };
};
