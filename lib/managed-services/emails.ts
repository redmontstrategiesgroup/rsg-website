/**
 * Managed-services email helpers (server-only).
 *
 * Follows the lib/leads.ts Resend pattern: gated on RESEND_API_KEY, sender
 * from CONTACT_FROM_EMAIL, admin notifications to CONTACT_TO_EMAIL. Email
 * failures are never fatal — billing/webhook flows log and continue.
 */

import { Resend } from "resend";
import { DEFAULT_CONTACT_TO_EMAIL } from "@/lib/lead-score";

function fromAddress(): string {
  return process.env.CONTACT_FROM_EMAIL ?? "RSG <onboarding@resend.dev>";
}

function adminAddress(): string {
  return process.env.CONTACT_TO_EMAIL?.trim() || DEFAULT_CONTACT_TO_EMAIL;
}

async function send(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to,
      subject,
      html,
      text,
    });
    if (error) {
      console.error("[managed-services] email send failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[managed-services] email error:", err);
    return false;
  }
}

/** Notify the RSG owner/admin inbox. Never throws. */
export async function sendAdminEmail(
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  return send(adminAddress(), subject, html, text);
}

/** Notify a client. Never throws. */
export async function sendClientEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  if (!to) return false;
  return send(to, subject, html, text);
}
