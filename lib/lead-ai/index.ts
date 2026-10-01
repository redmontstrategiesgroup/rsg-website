import { Resend } from "resend";
import { generateStructured, type StructuredSchema } from "@/lib/ai/proxy";
import { enqueueEmailJob } from "@/lib/email-jobs";
import { callProvider, redact } from "@/lib/integration-log";
import { siteUrl } from "@/lib/lifecycle/core";
import { contactNotifyEmails, DEFAULT_OWNER_NOTIFY_EMAIL } from "@/lib/notify-emails";
import { getLeadById, updateLead } from "@/lib/store";
import { emitEvent } from "@/lib/webhooks/emit";
import { analyzeLead, type AnalyzeDeps, type AnalyzeResult } from "./analyze.ts";
import { resolveSignature, toReplyHtml } from "./compose.ts";
import { claimSend, completeSend, getInsight, insertInsight, releaseSend, updateLeadAi } from "./db.ts";
import { sendLeadReply, type ReplyEmail, type ReplyInput, type ReplyResult } from "./reply.ts";
import { LEAD_AI_TOOL } from "./schema.ts";

/**
 * Production wiring for lead AI. Pure logic lives in analyze.ts / reply.ts;
 * this file binds it to Supabase, the Anthropic proxy, and Resend.
 */

export const LEAD_AI_MODEL = process.env.LEAD_AI_MODEL ?? "claude-sonnet-5";

export function leadAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function replySignature(): string {
  return resolveSignature(process.env.LEAD_REPLY_SIGNATURE);
}

function analyzeDeps(): AnalyzeDeps {
  return {
    loadLead: getLeadById,
    generate: async ({ system, message }) => {
      let usage = { inputTokens: 0, outputTokens: 0 };
      const output = await generateStructured<unknown>({
        tenantId: "rsg-lead-ai",
        app: "lead_ai",
        system,
        input: message,
        schema: LEAD_AI_TOOL as StructuredSchema,
        model: LEAD_AI_MODEL,
        maxTokens: 1500,
        requestOptions: { timeout: 30_000, maxRetries: 1 },
        onUsage: (u) => {
          usage = { inputTokens: u.inputTokens, outputTokens: u.outputTokens };
        },
      });
      return { output, model: LEAD_AI_MODEL, ...usage };
    },
    insertInsight,
    updateLeadAi,
    redact,
    notifyHotUpgrade: async ({ lead, before, after, rationale }) => {
      const to = contactNotifyEmails();
      const from = process.env.CONTACT_FROM_EMAIL ?? "RSG Website <onboarding@resend.dev>";
      const subject = `Lead upgraded to hot: ${lead.name}${lead.company ? ` (${lead.company})` : ""}`;
      const text = `Claude raised this lead's score from ${before} to ${after}.

${rationale}

Review and send the drafted reply: ${siteUrl()}/admin`;
      const html = toReplyHtml(text);
      await emitEvent(
        "lead.hot",
        {
          leadId: lead.id,
          name: lead.name,
          email: lead.email,
          company: lead.company,
          scoreBefore: before,
          scoreAfter: after,
          rationale,
        },
        { eventId: `lead.hot:${lead.id}:${after}` }
      );
      const apiKey = process.env.RESEND_API_KEY;
      try {
        if (!apiKey) throw new Error("RESEND_API_KEY missing");
        const resend = new Resend(apiKey);
        await callProvider({ provider: "resend", operation: "email.send.lead_hot_upgrade" }, async () => {
          const { data, error } = await resend.emails.send({ from, to, subject, text, html });
          if (error) throw new Error(error.message);
          return data;
        });
      } catch (err) {
        console.warn("[lead-ai] hot-upgrade alert send failed, queued for retry", {
          error: redact(err instanceof Error ? err.message : String(err)),
        });
        const queued = await enqueueEmailJob("lead_hot_upgrade", { to, from, subject, text, html });
        if (!queued) console.error("[lead-ai] hot-upgrade alert could not be queued");
      }
    },
    model: LEAD_AI_MODEL,
    bookingUrl: `${siteUrl()}/book`,
    signature: replySignature(),
  };
}

export async function runLeadAnalysis(leadId: string): Promise<AnalyzeResult> {
  const result = await analyzeLead(leadId, analyzeDeps());
  if (result.ok) {
    await emitEvent(
      "lead.analyzed",
      { leadId, insightId: result.insightId },
      { eventId: `lead.analyzed:${result.insightId}` }
    );
  }
  return result;
}

function replyFrom(): string {
  return (
    process.env.LEAD_REPLY_FROM_EMAIL ??
    process.env.CONTACT_FROM_EMAIL ??
    "RSG Website <onboarding@resend.dev>"
  );
}

async function sendReplyEmail(msg: ReplyEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email is not configured: RESEND_API_KEY is missing.");
  const resend = new Resend(apiKey);
  await callProvider({ provider: "resend", operation: "email.send.lead_reply" }, async () => {
    const { data, error } = await resend.emails.send(
      {
        from: replyFrom(),
        to: msg.to,
        replyTo: DEFAULT_OWNER_NOTIFY_EMAIL,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      },
      { idempotencyKey: msg.idempotencyKey },
    );
    if (error) {
      throw Object.assign(new Error(error.message), {
        name: error.name,
        status: (error as { statusCode?: number }).statusCode,
      });
    }
    return data;
  });
}

export async function sendReply(input: ReplyInput): Promise<ReplyResult> {
  const result = await sendLeadReply(input, {
    getLead: getLeadById,
    getInsight,
    claimSend,
    releaseSend,
    completeSend,
    sendEmail: sendReplyEmail,
    markContacted: async (leadId) => {
      await updateLead(leadId, { status: "contacted" });
    },
  });
  if (result.ok) {
    await emitEvent(
      "lead.reply_sent",
      { leadId: input.leadId, insightId: result.insight.id, subject: input.subject.trim() },
      { eventId: `lead.reply_sent:${result.insight.id}` }
    );
  }
  return result;
}
