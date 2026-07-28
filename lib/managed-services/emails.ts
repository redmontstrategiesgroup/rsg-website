/**
 * Managed-services email helpers (server-only).
 *
 * Follows the lib/leads.ts Resend pattern: gated on RESEND_API_KEY, sender
 * from CONTACT_FROM_EMAIL, admin notifications to CONTACT_TO_EMAIL. Email
 * failures are never fatal — billing/webhook flows log and continue.
 */

import { Resend } from "resend";
import { DEFAULT_CONTACT_TO_EMAIL } from "@/lib/lead-score";
import { callProvider, recordSkipped } from "@/lib/integration-log";

function fromAddress(): string {
  return process.env.CONTACT_FROM_EMAIL ?? "RSG <onboarding@resend.dev>";
}

function adminAddress(): string {
  return process.env.CONTACT_TO_EMAIL?.trim() || DEFAULT_CONTACT_TO_EMAIL;
}

/**
 * Single funnel for every managed-services email, so instrumentation lives in
 * one place rather than at each caller.
 *
 * Still never throws — billing and webhook flows must continue when email
 * fails. The difference from before is that the failure is now *recorded*
 * against the Resend connection instead of vanishing into a console line: a
 * dead API key now moves last_success_at and shows up in the health endpoint.
 */
async function send(
  to: string,
  subject: string,
  html: string,
  text: string,
  operation = "email.send.managed_services"
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await recordSkipped(
      { provider: "resend", operation },
      "RESEND_API_KEY not set"
    );
    return false;
  }
  try {
    const resend = new Resend(apiKey);
    await callProvider({ provider: "resend", operation }, async () => {
      const { data, error } = await resend.emails.send({
        from: fromAddress(),
        to,
        subject,
        html,
        text,
      });
      // Resend reports failures in-band; rethrow so the wrapper can classify.
      if (error) {
        throw Object.assign(new Error(error.message), {
          name: error.name,
          status: (error as { statusCode?: number }).statusCode,
        });
      }
      return data;
    });
    return true;
  } catch {
    // Already classified, redacted, and recorded by callProvider.
    return false;
  }
}

/** Notify the RSG owner/admin inbox. Never throws. */
export async function sendAdminEmail(
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  return send(adminAddress(), subject, html, text, "email.send.admin_notice");
}

/** Notify a client. Never throws. */
export async function sendClientEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  if (!to) return false;
  return send(to, subject, html, text, "email.send.client_notice");
}
