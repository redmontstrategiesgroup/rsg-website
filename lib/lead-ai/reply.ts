import type { Lead } from "../types.ts";
import { toReplyHtml } from "./compose.ts";
import type { LeadInsight } from "./types.ts";

/**
 * Admin-initiated send of a drafted first reply. The claim (sent_at set while
 * null) happens before the email, so two clicks can never send twice. A failed
 * email releases the claim; anything after a successful email is best-effort
 * and never releases (the lead already has the message).
 */

export type ReplyInput = {
  leadId: string;
  insightId: string;
  subject: string;
  body: string;
  adminId: string;
};

export type ReplyEmail = { to: string; subject: string; text: string; html: string };

export type ReplyDeps = {
  getLead: (id: string) => Promise<Lead | null>;
  getInsight: (id: string) => Promise<LeadInsight | null>;
  claimSend: (insightId: string, adminId: string) => Promise<boolean>;
  releaseSend: (insightId: string) => Promise<void>;
  completeSend: (insightId: string, subject: string, body: string) => Promise<void>;
  sendEmail: (msg: ReplyEmail) => Promise<void>;
  markContacted: (leadId: string) => Promise<void>;
};

export type ReplyResult =
  | { ok: true; insight: LeadInsight }
  | { ok: false; status: 404 | 409 | 422 | 502; error: string };

export async function sendLeadReply(input: ReplyInput, deps: ReplyDeps): Promise<ReplyResult> {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || subject.length > 200) {
    return { ok: false, status: 422, error: "Subject must be 1–200 characters." };
  }
  if (!body || body.length > 5000) {
    return { ok: false, status: 422, error: "Message must be 1–5000 characters." };
  }

  const lead = await deps.getLead(input.leadId);
  if (!lead) return { ok: false, status: 404, error: "Lead not found." };
  const insight = await deps.getInsight(input.insightId);
  if (!insight || insight.leadId !== input.leadId) {
    return { ok: false, status: 404, error: "Draft not found for this lead." };
  }
  if (!lead.email) {
    return { ok: false, status: 422, error: "This lead has no email address." };
  }

  if (!(await deps.claimSend(input.insightId, input.adminId))) {
    return { ok: false, status: 409, error: "This reply was already sent." };
  }

  try {
    await deps.sendEmail({ to: lead.email, subject, text: body, html: toReplyHtml(body) });
  } catch (err) {
    await deps.releaseSend(input.insightId).catch((e) =>
      console.error("[lead-ai] could not release send claim", e),
    );
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : "Email send failed.",
    };
  }

  const sentAt = new Date().toISOString();
  try {
    await deps.completeSend(input.insightId, subject, body);
  } catch (err) {
    console.error("[lead-ai] reply sent but not recorded", { insightId: input.insightId, err });
  }
  if ((lead.status ?? "new") === "new") {
    try {
      await deps.markContacted(input.leadId);
    } catch (err) {
      console.error("[lead-ai] reply sent but status not updated", { leadId: input.leadId, err });
    }
  }

  return {
    ok: true,
    insight: {
      ...insight,
      sentAt,
      sentBy: input.adminId,
      sentSubject: subject,
      sentBody: body,
    },
  };
}
