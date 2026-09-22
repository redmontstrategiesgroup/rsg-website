import { Resend } from "resend";
import { randomUUID } from "node:crypto";
import { contactNotifyEmails } from "./notify-emails.ts";
import { getSupabase } from "./supabase.ts";
import type { Lead, LeadStatus } from "./types.ts";
import { callProvider } from "./integration-log.ts";
import { toLeadDto, type LeadRow } from "./apiv1/serializers-admin.ts";

export { scoreLead } from "./lead-score.ts";
export {
  DEFAULT_CONTACT_TO_EMAIL,
  DEFAULT_OWNER_NOTIFY_EMAIL,
  DEFAULT_CONTACT_NOTIFY_EMAILS,
  contactNotifyEmails,
} from "./notify-emails.ts";

export type LeadStorageMetadata = {
  status: LeadStatus;
  score: number;
  scoreBucket: "cold" | "warm" | "hot";
  routingLabel: "follow_up" | "priority_follow_up" | "nurture";
  storagePayload: Record<string, unknown>;
};

function determineScoreBucket(score: number): LeadStorageMetadata["scoreBucket"] {
  if (score >= 70) return "hot";
  if (score >= 45) return "warm";
  return "cold";
}

function determineRoutingLabel(score: number): LeadStorageMetadata["routingLabel"] {
  if (score >= 70) return "priority_follow_up";
  if (score >= 45) return "follow_up";
  return "nurture";
}

export function deriveLeadStorageMetadata(lead: Lead): LeadStorageMetadata {
  const score = Math.max(0, Math.min(100, lead.score ?? 0));
  const status = (lead.status ?? "new") as LeadStatus;
  return {
    status,
    score,
    scoreBucket: determineScoreBucket(score),
    routingLabel: determineRoutingLabel(score),
    storagePayload: {
      status,
      lead_score: score,
      score_bucket: determineScoreBucket(score),
      routing_label: determineRoutingLabel(score),
    },
  };
}

/*
 * Shared lead pipeline, used by the contact-form server action, the chatbot's
 * lead handoff, and every other intake route. Server-side only; holds Resend
 * and workflow secrets.
 */

/**
 * Map a lead onto the `public.leads` columns. Exported so the mapping can be
 * asserted against what store.ts reads back: a column dropped here is a field
 * that silently disappears from the admin console.
 */
export function leadToRow(lead: Lead): Record<string, unknown> {
  return {
    id: lead.id,
    name: lead.name,
    business_name: lead.company || lead.name,
    website: lead.website ?? "",
    email: lead.email,
    phone: lead.phone ?? "",
    industry: lead.industry ?? "",
    biggest_problem: lead.problem ?? "",
    improvement_goal: lead.improve ?? "",
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
    created_at: lead.submittedAt ?? new Date().toISOString(),
    // Demo context rides in the snapshot: rowToLead reads it back out so the
    // admin lead view shows which demo interactions produced the request.
    ...(lead.demo
      ? {
          qualification_snapshot: { demoRequest: lead.demo },
          employee_count: lead.demo.businessSize ?? "",
          service_requested: lead.demo.system,
        }
      : {}),
    ...(lead.servicePlanAnswers
      ? { service_plan_answers: lead.servicePlanAnswers }
      : {}),
    ...(lead.recommendedPlan ? { recommended_plan: lead.recommendedPlan } : {}),
  };
}

/**
 * Durable capture: the `leads` table is what the admin console reads, so a
 * submission that does not land here never appears in the portal no matter how
 * many notification emails went out. Every other sink (file store, n8n, email)
 * is a convenience on top of this one.
 */
/**
 * Webhook emission for leads. Loaded lazily and only when Supabase is
 * configured: this module is imported by hermetic node tests with relative
 * paths, and the emitter's dependency chain uses `@/` aliases that only
 * resolve under Next or the test alias hook. Never throws.
 */
async function emitLeadEvent(type: "lead.created" | "lead.updated", row: LeadRow): Promise<void> {
  if (!getSupabase()) return;
  try {
    const { emitEvent } = await import("./webhooks/emit.ts");
    await emitEvent(type, toLeadDto(row), { entityId: row.id, version: row.created_at });
  } catch (err) {
    console.error("[leads] webhook emit failed", { type, id: row.id, error: err instanceof Error ? err.message : String(err) });
  }
}

async function storeInSupabase(lead: Lead): Promise<{ ok: boolean; id?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false };

  try {
    const row = leadToRow(lead);
    const { data, error } = await supabase
      .from("leads")
      .insert(row)
      .select("*")
      .limit(1);
    if (error) throw error;
    const inserted = (data as LeadRow[] | null)?.[0];
    if (inserted?.id) void emitLeadEvent("lead.created", inserted);
    return { ok: true, id: inserted?.id ?? lead.id };
  } catch (err) {
    // Loud on purpose: this is the failure that makes a lead invisible in the
    // admin portal, and the visitor still sees a success screen.
    console.error(
      "[leads] Supabase insert failed: lead will NOT appear in the admin console.",
      { email: lead.email, error: err instanceof Error ? err.message : err }
    );
    return { ok: false };
  }
}

const N8N_LEAD_PATH = "/webhook/rsg-lead-capture";

/**
 * Accept either an n8n base URL or the full webhook URL. The configured value
 * is the full URL, and blindly appending the path produced
 * `…/webhook/rsg-lead-capture/webhook/rsg-lead-capture`, which 404s on every
 * submission.
 */
export function n8nLeadWebhookUrl(configured: string): string {
  const base = configured.trim().replace(/\/+$/, "");
  return base.endsWith(N8N_LEAD_PATH) ? base : `${base}${N8N_LEAD_PATH}`;
}

async function dispatchToN8n(lead: Lead): Promise<{ ok: boolean; id?: string }> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL || process.env.N8N_URL;
  if (!webhookUrl) return { ok: false };

  try {
    const response = await fetch(n8nLeadWebhookUrl(webhookUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rsg-source": lead.source ?? "website_contact_form",
      },
      body: JSON.stringify({
        email: lead.email || "",
        name: lead.name || "",
        phone: lead.phone || "",
        company: lead.company || "",
        message: lead.problem || lead.improve || "",
        source: lead.source ?? "website_contact_form",
        captured_at: lead.submittedAt ?? new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error("[leads] n8n webhook failed", response.status, response.statusText);
      return { ok: false };
    }

    return { ok: true, id: lead.id };
  } catch (err) {
    console.error("[leads] n8n dispatch error:", err);
    return { ok: false };
  }
}

async function emailOwner(lead: Lead): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const to = contactNotifyEmails();

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
          : lead.source === "website_private_ai_designer"
            ? "Private AI System Designer"
            : lead.source === "interactive_demo"
              ? `Interactive demo: ${lead.demo?.system ?? "demo system"}`
              : "Contact form",
    ],
    ...(lead.demo
      ? ([
          ["Demo viewed", `${lead.demo.system} (${lead.demo.businessCategory})`],
          [
            "Features explored in demo",
            lead.demo.featuresExplored.length
              ? lead.demo.featuresExplored.join(", ")
              : "-",
          ],
          [
            "Services requested",
            lead.demo.featuresRequested.length
              ? lead.demo.featuresRequested.join(", ")
              : "-",
          ],
          ["Business size", lead.demo.businessSize || "-"],
          [
            "Preferred meeting",
            [lead.demo.preferredDate, lead.demo.preferredTime]
              .filter(Boolean)
              .join(" · ") || "-",
          ],
          ["Scenarios run in demo", String(lead.demo.scenariosRun ?? 0)],
          ...Object.entries(lead.demo.extras ?? {}).map(
            ([k, v]) =>
              [k.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase()), v] as [
                string,
                string,
              ],
          ),
        ] as [string, string][])
      : []),
    ["Name", lead.name],
    ["Business name", lead.company || "-"],
    ["Website", lead.website || "-"],
    ["Email", lead.email || "-"],
    ["Phone", lead.phone || "-"],
    ["Industry", lead.industry || "-"],
    ["Preferred contact", lead.preferredContact || "-"],
    ["Best time", lead.bestTime || "-"],
    ["Timeline", lead.timeline || "-"],
    ["Yearly revenue", lead.yearlyRevenue || "-"],
    ["Biggest problem", lead.problem || "-"],
    ["Wants to improve", lead.improve || "-"],
    ["Submitted from", lead.pageUrl || "-"],
    ["Referrer", lead.referrer || "-"],
    ["Campaign", attribution || "-"],
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

  const subject =
    lead.source === "interactive_demo"
      ? `Demo system request: ${lead.name}${lead.company ? `: ${lead.company}` : ""} (${lead.demo?.system ?? "interactive demo"})`
      : `New RSG lead: ${lead.name}${lead.company ? `: ${lead.company}` : ""}`;

  try {
    const resend = new Resend(apiKey);
    await callProvider(
      { provider: "resend", operation: "email.send.lead_notification" },
      async () => {
        const { data, error } = await resend.emails.send({
          from:
            process.env.CONTACT_FROM_EMAIL ??
            "RSG Website <onboarding@resend.dev>",
          to,
          ...(lead.email ? { replyTo: lead.email } : {}),
          subject,
          html,
          text: textBody,
        });
        // Resend reports failures in-band; rethrow so the wrapper classifies
        // it the same way it classifies a thrown network error. Previously the
        // two took separate paths with identical fallback code.
        if (error) {
          throw Object.assign(new Error(error.message), {
            name: error.name,
            status: (error as { statusCode?: number }).statusCode,
          });
        }
        return data;
      }
    );
    return true;
  } catch {
    // Already classified, redacted, and recorded. The lead is never lost,
    // it falls through to the durable retry queue, which carries this
    // request's correlation id forward so the eventual delivery (or dead
    // letter, hours later) joins back to this request.
    const { enqueueEmailJob } = await import("@/lib/email-jobs");
    await enqueueEmailJob("contact_notification", {
      to,
      from:
        process.env.CONTACT_FROM_EMAIL ??
        "RSG Website <onboarding@resend.dev>",
      replyTo: lead.email || undefined,
      subject,
      html,
      text: textBody,
    });
    return false;
  }
}

export type ProcessLeadResult = {
  storedLocally: boolean;
  /** True if any remote sink accepted the lead (database or n8n). */
  storedRemotely: boolean;
  /** True only if the lead is in the `leads` table, i.e. in the admin portal. */
  storedInDatabase: boolean;
  emailed: boolean;
  duplicate: boolean;
  leadId?: string;
};

  /** Persist a lead everywhere configured and notify the owner. */
export async function processLead(lead: Lead): Promise<ProcessLeadResult> {
  // Deduplicate accidental double-submits within 10 minutes.
  const { findRecentLeadByEmail } = await import("./store.ts");
  const recent = await findRecentLeadByEmail(lead.email, 10 * 60_000);
  if (recent) {
    return {
      storedLocally: true,
      storedRemotely: Boolean(recent.id),
      storedInDatabase: Boolean(recent.id),
      emailed: true, // prior submission already notified
      duplicate: true,
      leadId: recent.id,
    };
  }

  const leadId = lead.id ?? randomUUID();
  const metadata = deriveLeadStorageMetadata(lead);
  const prepared: Lead = {
    ...lead,
    id: leadId,
    status: metadata.status,
    score: metadata.score,
  };

  // 1. Local file store (dev only: production refuses file writes).
  const { saveLead } = await import("./store.ts");
  const storedLocally = await saveLead(prepared, metadata.storagePayload);

  // 2. Supabase `leads` table. This is the durable record and the only sink
  //    the admin console reads, so it runs before the optional automation.
  const stored = await storeInSupabase(prepared);
  const storedInDatabase = stored.ok;

  // 3. n8n automation workflow (optional downstream routing, not storage).
  const remote = await dispatchToN8n(prepared);
  const storedRemotely = storedInDatabase || remote.ok;

  if (process.env.NODE_ENV === "production" && !remote.ok) {
    console.warn(
      "[leads] n8n workflow unavailable: lead still captured in the database and by email.",
      { email: prepared.email }
    );
  }

  // 4. Email notification (when Resend is configured); failures enqueue retry.
  const emailed = await emailOwner(prepared);

  if (!storedLocally && !storedInDatabase) {
    console.error(
      "[leads] Lead was not persisted to file store or Supabase.",
      { email: prepared.email, emailed }
    );
  }

  return {
    storedLocally,
    storedRemotely,
    storedInDatabase,
    emailed,
    duplicate: false,
    leadId: stored.id ?? remote.id ?? leadId,
  };
}
