import { Resend } from "resend";
import { randomUUID } from "node:crypto";
import { saveLead, findRecentLeadByEmail } from "./store";
import { getSupabase } from "./supabase";
import { DEFAULT_CONTACT_TO_EMAIL } from "./lead-score";
import type { Lead } from "./types";

export { scoreLead, DEFAULT_CONTACT_TO_EMAIL } from "./lead-score";

/**
 * Shared lead pipeline, used by the contact-form server action and the
 * chatbot's lead handoff. Server-side only — holds Resend/Supabase secrets.
 */

async function storeInSupabase(lead: Lead): Promise<{ ok: boolean; id?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false };
  try {
    const { data, error } = await supabase
      .from("leads")
      .insert({
        id: lead.id,
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
        status: lead.status ?? "new",
        notes: lead.notes ?? "",
        owner: lead.owner ?? "",
      })
      .select("id")
      .limit(1);
    if (error) {
      // Older schemas may lack status/notes/owner — retry with core columns.
      if (/status|notes|owner|column/i.test(error.message)) {
        const { data: fallback, error: fallbackError } = await supabase
          .from("leads")
          .insert({
            id: lead.id,
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
          })
          .select("id")
          .limit(1);
        if (fallbackError) {
          console.error("[leads] Supabase insert failed:", fallbackError.message);
          return { ok: false };
        }
        return { ok: true, id: (fallback as { id: string }[] | null)?.[0]?.id };
      }
      console.error("[leads] Supabase insert failed:", error.message);
      return { ok: false };
    }
    return { ok: true, id: (data as { id: string }[] | null)?.[0]?.id };
  } catch (err) {
    console.error("[leads] Supabase error:", err);
    return { ok: false };
  }
}

function contactToEmail(): string {
  return (
    process.env.CONTACT_TO_EMAIL?.trim() || DEFAULT_CONTACT_TO_EMAIL
  );
}

async function emailOwner(lead: Lead): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const to = contactToEmail();

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
    [
      "Captured via",
      lead.source === "website_chat"
        ? "Site chat assistant"
        : lead.source === "website_connect_page"
          ? "RSG Connect Page"
          : "Contact form",
    ],
    ["Name", lead.name],
    ["Business name", lead.company || "—"],
    ["Website", lead.website || "—"],
    ["Email", lead.email || "—"],
    ["Phone", lead.phone || "—"],
    ["Industry", lead.industry || "—"],
    ["Preferred contact", lead.preferredContact || "—"],
    ["Best time", lead.bestTime || "—"],
    ["Timeline", lead.timeline || "—"],
    ["Yearly revenue", lead.yearlyRevenue || "—"],
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
      <p style="margin: 24px 0 0; font-size: 13px; color: #888;">
        Review this lead in the <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://redmontstrategiesgroup.com"}/admin">admin console</a>.
      </p>
    </div>`;

  const textBody = rows.map(([label, value]) => `${label}: ${value}`).join("\n");

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.CONTACT_FROM_EMAIL ?? "RSG Website <onboarding@resend.dev>",
      to,
      ...(lead.email ? { replyTo: lead.email } : {}),
      subject: `New RSG lead: ${lead.name}${lead.company ? ` — ${lead.company}` : ""}`,
      html,
      text: textBody,
    });
    if (error) {
      console.error("[leads] Resend send failed:", error.message);
      const { enqueueEmailJob } = await import("@/lib/email-jobs");
      await enqueueEmailJob("contact_notification", {
        to,
        from:
          process.env.CONTACT_FROM_EMAIL ??
          "RSG Website <onboarding@resend.dev>",
        replyTo: lead.email || undefined,
        subject: `New RSG lead: ${lead.name}${lead.company ? ` — ${lead.company}` : ""}`,
        html,
        text: textBody,
      });
      return false;
    }
    return true;
  } catch (err) {
    console.error("[leads] Resend error:", err);
    const { enqueueEmailJob } = await import("@/lib/email-jobs");
    await enqueueEmailJob("contact_notification", {
      to,
      from:
        process.env.CONTACT_FROM_EMAIL ??
        "RSG Website <onboarding@resend.dev>",
      replyTo: lead.email || undefined,
      subject: `New RSG lead: ${lead.name}${lead.company ? ` — ${lead.company}` : ""}`,
      html,
      text: textBody,
    });
    return false;
  }
}

export type ProcessLeadResult = {
  storedLocally: boolean;
  storedRemotely: boolean;
  emailed: boolean;
  duplicate: boolean;
  leadId?: string;
};

  /** Persist a lead everywhere configured and notify the owner. */
export async function processLead(lead: Lead): Promise<ProcessLeadResult> {
  // Deduplicate accidental double-submits within 10 minutes.
  const recent = await findRecentLeadByEmail(lead.email, 10 * 60_000);
  if (recent) {
    return {
      storedLocally: true,
      storedRemotely: Boolean(recent.id),
      emailed: true, // prior submission already notified
      duplicate: true,
      leadId: recent.id,
    };
  }

  const leadId = lead.id ?? randomUUID();
  const prepared: Lead = {
    ...lead,
    id: leadId,
    status: lead.status ?? "new",
  };

  // 1. Local file store (dev only — production refuses file writes).
  const storedLocally = await saveLead(prepared);

  // 2. Supabase (required for durable production storage).
  const remote = await storeInSupabase(prepared);
  const storedRemotely = remote.ok;

  if (process.env.NODE_ENV === "production" && !storedRemotely) {
    console.error(
      "[leads] Production lead not stored in Supabase — check configuration.",
      { email: prepared.email }
    );
  }

  // 3. Email notification (when Resend is configured); failures enqueue retry.
  const emailed = await emailOwner(prepared);

  if (!storedLocally && !storedRemotely) {
    console.error(
      "[leads] Lead was not persisted to file store or Supabase.",
      { email: prepared.email, emailed }
    );
  }

  return {
    storedLocally,
    storedRemotely,
    emailed,
    duplicate: false,
    leadId: remote.id ?? leadId,
  };
}
