import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { saveLead } from "./store";
import type { Lead } from "./types";

/**
 * Shared lead pipeline, used by the contact-form server action and the
 * chatbot's lead handoff. Server-side only — holds Resend/Supabase secrets.
 */

/**
 * Basic lead scoring (0–100): buying timeline is the strongest signal,
 * followed by industry fit and how concretely the problem is described.
 */
export function scoreLead(lead: Lead): number {
  let score = 0;

  switch (lead.timeline) {
    case "Immediately":
      score += 40;
      break;
    case "This month":
      score += 30;
      break;
    case "Next 90 days":
      score += 15;
      break;
  }

  if (lead.industry) {
    score += /med spa|aesthetic|dental|high-ticket/i.test(lead.industry)
      ? 20
      : 10;
  }

  const narrative = `${lead.problem} ${lead.improve}`;
  if (lead.problem.length >= 80) score += 10;
  if (/lead|follow.?up|missed call|booking|convert|no.?show/i.test(narrative)) {
    score += 10;
  }

  if (lead.phone) score += 5;
  if (lead.website) score += 5;
  if (lead.preferredContact === "Call" || lead.preferredContact === "Text") {
    score += 5;
  }
  if (lead.utmSource) score += 5;

  return Math.min(100, score);
}

async function storeInSupabase(lead: Lead): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    });
    const { error } = await supabase.from("leads").insert({
      name: lead.name,
      business_name: lead.company,
      website: lead.website,
      email: lead.email,
      phone: lead.phone,
      industry: lead.industry,
      biggest_problem: lead.problem,
      improvement_goal: lead.improve,
      preferred_contact: lead.preferredContact ?? "",
      best_time: lead.bestTime ?? "",
      timeline: lead.timeline ?? "",
      page_url: lead.pageUrl ?? "",
      referrer: lead.referrer ?? "",
      utm_source: lead.utmSource ?? "",
      utm_medium: lead.utmMedium ?? "",
      utm_campaign: lead.utmCampaign ?? "",
      utm_content: lead.utmContent ?? "",
      utm_term: lead.utmTerm ?? "",
      lead_score: lead.score ?? 0,
      source: lead.source ?? "website_contact_form",
    });
    if (error) {
      console.error("[leads] Supabase insert failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[leads] Supabase error:", err);
    return false;
  }
}

async function emailOwner(lead: Lead): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey) return false;
  if (!to) {
    console.warn(
      "[leads] RESEND_API_KEY is set but CONTACT_TO_EMAIL is not — no email sent."
    );
    return false;
  }

  const attribution = [
    lead.utmSource && `source: ${lead.utmSource}`,
    lead.utmMedium && `medium: ${lead.utmMedium}`,
    lead.utmCampaign && `campaign: ${lead.utmCampaign}`,
    lead.utmContent && `content: ${lead.utmContent}`,
    lead.utmTerm && `term: ${lead.utmTerm}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const rows: [string, string][] = [
    ["Lead score", `${lead.score ?? 0} / 100`],
    ["Captured via", lead.source === "website_chat" ? "Site chat assistant" : "Contact form"],
    ["Name", lead.name],
    ["Business name", lead.company || "—"],
    ["Website", lead.website || "—"],
    ["Email", lead.email || "—"],
    ["Phone", lead.phone || "—"],
    ["Industry", lead.industry || "—"],
    ["Preferred contact", lead.preferredContact || "—"],
    ["Best time", lead.bestTime || "—"],
    ["Timeline", lead.timeline || "—"],
    ["Biggest problem", lead.problem || "—"],
    ["Wants to improve", lead.improve || "—"],
    ["Submitted from", lead.pageUrl || "—"],
    ["Referrer", lead.referrer || "—"],
    ["Campaign", attribution || "—"],
    ["Submitted", new Date(lead.submittedAt).toUTCString()],
  ];

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px;">
      <h2 style="margin: 0 0 4px;">New RSG Strategy Call Lead</h2>
      <p style="margin: 0 0 20px; color: #666;">Submitted through the website.</p>
      <table style="border-collapse: collapse; width: 100%;">
        ${rows
          .map(
            ([label, value]) => `
          <tr>
            <td style="padding: 8px 12px 8px 0; color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; vertical-align: top; white-space: nowrap;">${label}</td>
            <td style="padding: 8px 0; font-size: 15px; color: #111;">${esc(value)}</td>
          </tr>`
          )
          .join("")}
      </table>
    </div>`;

  const textBody = rows.map(([label, value]) => `${label}: ${value}`).join("\n");

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.CONTACT_FROM_EMAIL ?? "RSG Website <onboarding@resend.dev>",
      to,
      ...(lead.email ? { replyTo: lead.email } : {}),
      subject: "New RSG Strategy Call Lead",
      html,
      text: textBody,
    });
    if (error) {
      console.error("[leads] Resend send failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[leads] Resend error:", err);
    return false;
  }
}

export type ProcessLeadResult = {
  storedLocally: boolean;
  storedRemotely: boolean;
  emailed: boolean;
};

/** Persist a lead everywhere configured and notify the owner. */
export async function processLead(lead: Lead): Promise<ProcessLeadResult> {
  // 1. Local file store (feeds the admin console; may be read-only on Vercel).
  let storedLocally = false;
  try {
    await saveLead(lead);
    storedLocally = true;
  } catch (err) {
    console.error("[leads] File store write failed:", err);
  }

  // 2. Supabase (durable production storage, when configured).
  const storedRemotely = await storeInSupabase(lead);

  // 3. Email notification (when configured).
  const emailed = await emailOwner(lead);

  return { storedLocally, storedRemotely, emailed };
}
