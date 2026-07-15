"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { processLead, scoreLead } from "@/lib/leads";
import { rateLimit } from "@/lib/security";
import { recordConnectEvent } from "@/lib/connect";
import type { Lead } from "@/lib/types";

function clean(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    const isControl =
      (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
    if (!isControl) out += ch;
  }
  return out.trim();
}

const text = (max: number) => z.string().transform(clean).pipe(z.string().max(max));
const CONTACT_METHODS = ["Call", "Text", "Email"] as const;
const YEARLY_REVENUE = [
  "$25,000–$49,999",
  "$50,000–$99,999",
  "$100,000–$249,999",
  "$250,000–$499,999",
  "$500,000–$999,999",
  "$1,000,000+",
] as const;

const ConnectLeadSchema = z.object({
  name: text(120).pipe(z.string().min(1, "Name is required.")),
  company: text(160).pipe(z.string().min(1, "Business name is required.")),
  email: text(254).pipe(z.string().email("Enter a valid email address.")),
  phone: text(40).optional().default(""),
  website: text(200).optional().default(""),
  problem: text(2000).pipe(
    z.string().min(1, "Tell us your primary business challenge.")
  ),
  preferredContact: z
    .enum(CONTACT_METHODS)
    .or(z.literal(""))
    .optional()
    .default(""),
  yearlyRevenue: z
    .enum(YEARLY_REVENUE)
    .or(z.literal(""))
    .optional()
    .default(""),
  consent: z.boolean(),
  company_site: z.string().max(300).optional().default(""),
  elapsedMs: z.number().finite().min(0).max(3_600_000),
  source: text(80).optional().default(""),
  campaign: text(120).optional().default(""),
  page_url: text(300).optional().default(""),
  referrer: text(300).optional().default(""),
  utm_source: text(200).optional().default(""),
  utm_medium: text(200).optional().default(""),
  utm_campaign: text(200).optional().default(""),
  sessionId: text(80).optional().default(""),
  visitorId: text(80).optional().default(""),
});

export type ConnectLeadResult =
  | { ok: true }
  | { ok: false; error: string; fields?: Record<string, string> };

export async function submitConnectLead(
  raw: unknown
): Promise<ConnectLeadResult> {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0].trim().slice(0, 64) ??
    hdrs.get("x-real-ip")?.slice(0, 64) ??
    "local";

  if (!(await rateLimit(`connect-lead:${ip}`, 5, 10 * 60_000))) {
    return {
      ok: false,
      error: "Too many requests. Please wait a few minutes and try again.",
    };
  }

  const parsed = ConnectLeadSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fields[key]) fields[key] = issue.message;
    }
    return {
      ok: false,
      error: Object.values(fields)[0] ?? "Please correct the highlighted fields.",
      fields,
    };
  }
  const data = parsed.data;

  if (data.company_site) return { ok: true };
  if (data.elapsedMs < 1200) {
    return {
      ok: false,
      error: "That was quick — please review your details and submit again.",
    };
  }
  if (!data.consent) {
    return {
      ok: false,
      error: "Please confirm we may contact you about this inquiry.",
      fields: { consent: "Consent is required." },
    };
  }

  const platform = data.source || data.utm_source || "connect";
  const lead: Lead = {
    name: data.name,
    company: data.company,
    email: data.email,
    phone: data.phone,
    website: data.website,
    industry: "",
    problem: data.problem,
    improve: "",
    preferredContact: data.preferredContact,
    yearlyRevenue: data.yearlyRevenue || undefined,
    notes: data.yearlyRevenue
      ? `Yearly revenue: ${data.yearlyRevenue}`
      : "",
    pageUrl: data.page_url || "/connect",
    referrer: data.referrer,
    utmSource: data.utm_source || platform,
    utmMedium: data.utm_medium || "connect_page",
    utmCampaign: data.utm_campaign || data.campaign || "rsg_connect",
    source: "website_connect_page",
    status: "new",
    submittedAt: new Date().toISOString(),
  };
  lead.score = scoreLead(lead);

  const { storedLocally, storedRemotely, emailed, duplicate } =
    await processLead(lead);

  if (!duplicate && !storedLocally && !storedRemotely && !emailed) {
    return {
      ok: false,
      error:
        "We couldn't process your submission right now. Please try again, or email contact@redmontstrategiesgroup.com.",
    };
  }

  await recordConnectEvent({
    eventType: "form_complete",
    sessionId: data.sessionId || undefined,
    visitorId: data.visitorId || undefined,
    source: platform,
    campaign: data.campaign || data.utm_campaign || undefined,
    referrer: data.referrer || undefined,
    path: "/connect",
    meta: { email: data.email, duplicate: Boolean(duplicate) },
  });

  return { ok: true };
}
