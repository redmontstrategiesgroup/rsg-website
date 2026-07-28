"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { Resend } from "resend";
import { processLead, scoreLead } from "@/lib/leads";
import { rateLimit } from "@/lib/security";
import type { Lead } from "@/lib/types";
import { callProvider } from "@/lib/integration-log";

/**
 * Contact form server action. All secrets stay server-side.
 *
 * Always: validates with Zod, applies spam checks, and records the lead.
 * If configured via env: verifies Cloudflare Turnstile, stores the lead in
 * Supabase (`leads` table), and emails the site owner through Resend.
 */

/** Strip control characters that have no business being in form input. */
function clean(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    const isControl = (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
    if (!isControl) out += ch;
  }
  return out.trim();
}

const text = (max: number) => z.string().transform(clean).pipe(z.string().max(max));

const CONTACT_METHODS = ["Call", "Text", "Email"] as const;
const BEST_TIMES = ["Morning", "Afternoon", "Evening"] as const;
const TIMELINES = [
  "Immediately",
  "This month",
  "Next 90 days",
  "Just exploring",
] as const;

const optionalChoice = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).or(z.literal("")).optional().default("");

const ContactSchema = z.object({
  name: text(120).pipe(z.string().min(1, "Name is required.")),
  company: text(160).pipe(z.string().min(1, "Business name is required.")),
  email: text(254).pipe(z.string().email("Enter a valid email address.")),
  website: text(200).optional().default(""),
  phone: text(40).optional().default(""),
  industry: text(80).optional().default(""),
  problem: text(4000).pipe(
    z.string().min(1, "Tell us the biggest problem you're facing right now.")
  ),
  improve: text(4000).optional().default(""),
  /** Intake preferences. */
  preferredContact: optionalChoice(CONTACT_METHODS),
  bestTime: optionalChoice(BEST_TIMES),
  timeline: optionalChoice(TIMELINES),
  /** Hidden attribution fields (captured client-side, never typed). */
  page_url: text(300).optional().default(""),
  referrer: text(300).optional().default(""),
  utm_source: text(200).optional().default(""),
  utm_medium: text(200).optional().default(""),
  utm_campaign: text(200).optional().default(""),
  utm_content: text(200).optional().default(""),
  utm_term: text(200).optional().default(""),
  /** Honeypot — hidden field, humans never fill it. */
  company_site: z.string().max(300).optional().default(""),
  /** Time from form mount to submit (bot heuristic). Required from the client. */
  elapsedMs: z.number().finite().min(0).max(3_600_000),
  /** Cloudflare Turnstile response token (when the widget is enabled). */
  turnstileToken: z.string().max(4000).optional().default(""),
});

export type ContactResult =
  | { ok: true }
  | { ok: false; error: string; fields?: Record<string, string> };

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  // Fail closed when the public widget is enabled but the secret is missing.
  if (siteKey && !secret) {
    console.error(
      "[contact] NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is missing."
    );
    return false;
  }
  if (!secret) return true; // Turnstile not configured — skip
  if (!token) return false;
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret,
          response: token,
          ...(ip && ip !== "local" ? { remoteip: ip } : {}),
        }),
      }
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[contact] Turnstile verification error:", err);
    return false;
  }
}

/** Confirmation email to the lead. Failures are logged, never user-facing. */
async function autoReply(lead: Lead): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const bookingUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/book`
      : "https://redmontstrategiesgroup.com/book";
  const firstName = lead.name.split(" ")[0] || lead.name;

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 540px; color: #111;">
      <p style="margin: 0 0 16px;">Hi ${firstName
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")},</p>
      <p style="margin: 0 0 16px;">
        Thank you for reaching out to Redmont Strategies Group. We've received
        your details and will review your business — your website, lead flow,
        and where you told us things are breaking down — before we respond.
      </p>
      <p style="margin: 0 0 16px;">
        You can expect to hear from us shortly. If you're ready to talk now,
        you can complete our consultation intake and book a strategy call:
      </p>
      <p style="margin: 0 0 24px;"><a href="${bookingUrl}" style="display: inline-block; background: #b3243a; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 14px;">Book a strategy call</a></p>
      <p style="margin: 0; color: #555;">— Redmont Strategies Group<br/>
      <span style="font-size: 12px; color: #999;">Business Consulting &amp; AI Strategy</span></p>
    </div>`;

  const textBody = [
    `Hi ${firstName},`,
    "",
    "Thank you for reaching out to Redmont Strategies Group. We've received your details and will review your business before we respond.",
    "",
    bookingUrl
      ? `Ready to talk now? Book a strategy call: ${bookingUrl}`
      : "If anything changes in the meantime, just reply to this email.",
    "",
    "— Redmont Strategies Group",
  ].join("\n");

  try {
    const resend = new Resend(apiKey);
    await callProvider(
      { provider: "resend", operation: "email.send.contact_autoreply" },
      async () => {
        const { data, error } = await resend.emails.send({
          from:
            process.env.CONTACT_FROM_EMAIL ?? "RSG Website <onboarding@resend.dev>",
          to: lead.email,
          subject: "Your request was received — Redmont Strategies Group",
          html,
          text: textBody,
        });
        if (error) {
          throw Object.assign(new Error(error.message), {
            name: error.name,
            status: (error as { statusCode?: number }).statusCode,
          });
        }
        return data;
      }
    );
  } catch {
    // Non-fatal — the lead is already captured; only the courtesy auto-reply
    // failed. Recorded by callProvider against the Resend connection.
  }
}

export async function submitContactForm(raw: unknown): Promise<ContactResult> {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0].trim().slice(0, 64) ??
    hdrs.get("x-real-ip")?.slice(0, 64) ??
    "local";

  if (!(await rateLimit(`contact:${ip}`, 5, 10 * 60_000))) {
    return {
      ok: false,
      error: "Too many requests. Please wait a few minutes and try again.",
    };
  }

  const parsed = ContactSchema.safeParse(raw);
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

  // Honeypot: pretend success, store nothing.
  if (data.company_site) return { ok: true };
  // Instant submissions are scripted, not typed.
  if (data.elapsedMs < 1500) {
    return {
      ok: false,
      error: "That was quick — please review your details and submit again.",
    };
  }

  if (!(await verifyTurnstile(data.turnstileToken, ip))) {
    return {
      ok: false,
      error: "Spam verification failed. Please try again.",
    };
  }

  const lead: Lead = {
    name: data.name,
    company: data.company,
    email: data.email,
    phone: data.phone,
    website: data.website,
    industry: data.industry,
    problem: data.problem,
    improve: data.improve,
    preferredContact: data.preferredContact,
    bestTime: data.bestTime,
    timeline: data.timeline,
    pageUrl: data.page_url,
    referrer: data.referrer,
    utmSource: data.utm_source,
    utmMedium: data.utm_medium,
    utmCampaign: data.utm_campaign,
    utmContent: data.utm_content,
    utmTerm: data.utm_term,
    source: "website_contact_form",
    status: "new",
    submittedAt: new Date().toISOString(),
  };
  lead.score = scoreLead(lead);

  // Persist everywhere configured (file store, Supabase) + notify the owner.
  const { storedLocally, storedRemotely, emailed, duplicate } =
    await processLead(lead);

  // Success requires at least one durable capture path OR email delivery.
  // Duplicates of a recent successful submit also count as success.
  if (!duplicate && !storedLocally && !storedRemotely && !emailed) {
    return {
      ok: false,
      error:
        "We couldn't process your submission right now. Please try again, or email us directly at contact@redmontstrategiesgroup.com.",
    };
  }

  // Confirmation to the lead — best-effort, after the lead is secured.
  // Skip auto-reply on near-duplicate submits to avoid inbox spam.
  if (!duplicate) {
    await autoReply(lead);
  }

  return { ok: true };
}
