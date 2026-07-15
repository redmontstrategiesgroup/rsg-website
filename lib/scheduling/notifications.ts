import { createHmac } from "node:crypto";
import { Resend } from "resend";
import { DEFAULT_CONTACT_TO_EMAIL } from "@/lib/lead-score";
import { requireSupabase, siteUrl } from "./db";
import { buildIcs } from "./ics";

export type TemplateVars = Record<string, string | number | undefined | null>;

function render(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

export async function getSettings() {
  const sb = requireSupabase();
  const { data } = await sb
    .from("scheduling_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  return (
    data ?? {
      id: "default",
      admin_timezone: "America/New_York",
      internal_notification_emails: [DEFAULT_CONTACT_TO_EMAIL],
      sender_name: "Redmont Strategies Group",
      reply_to: DEFAULT_CONTACT_TO_EMAIL,
      bookings_paused: false,
      abandon_hours: 24,
      max_follow_ups: 1,
      cancel_cutoff_minutes: 240,
      reschedule_cutoff_minutes: 240,
    }
  );
}

async function getTemplate(key: string) {
  const sb = requireSupabase();
  const { data } = await sb
    .from("notification_templates")
    .select("*")
    .eq("key", key)
    .eq("enabled", true)
    .maybeSingle();
  return data as {
    key: string;
    subject: string;
    body_html: string;
    body_text?: string | null;
    audience: string;
  } | null;
}

function fromAddress(settings: Awaited<ReturnType<typeof getSettings>>): string {
  return (
    process.env.CONTACT_FROM_EMAIL?.trim() ||
    `${settings.sender_name} <${settings.reply_to}>`
  );
}

export async function logDelivery(input: {
  templateKey?: string;
  recipient: string;
  subject?: string;
  status: "pending" | "sent" | "failed" | "skipped";
  providerId?: string;
  error?: string;
  bookingId?: string;
  leadId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    const sb = requireSupabase();
    await sb.from("notification_deliveries").insert({
      template_key: input.templateKey ?? null,
      recipient: input.recipient,
      subject: input.subject ?? null,
      channel: "email",
      status: input.status,
      provider_id: input.providerId ?? null,
      error: input.error ?? null,
      booking_id: input.bookingId ?? null,
      lead_id: input.leadId ?? null,
      meta: input.meta ?? {},
      sent_at: input.status === "sent" ? new Date().toISOString() : null,
    });
  } catch (err) {
    console.error("[scheduling] logDelivery failed", err);
  }
}

export async function sendTemplatedEmail(input: {
  templateKey: string;
  to: string | string[];
  vars: TemplateVars;
  bookingId?: string;
  leadId?: string;
  ics?: {
    filename: string;
    content: string;
    method?: string;
  };
}): Promise<{ ok: boolean; error?: string }> {
  const template = await getTemplate(input.templateKey);
  if (!template) {
    await logDelivery({
      templateKey: input.templateKey,
      recipient: Array.isArray(input.to) ? input.to.join(",") : input.to,
      status: "skipped",
      error: "Template missing or disabled",
      bookingId: input.bookingId,
      leadId: input.leadId,
    });
    return { ok: false, error: "Template missing" };
  }

  const settings = await getSettings();
  const subject = render(template.subject, input.vars);
  const html = render(template.body_html, input.vars);
  const text = template.body_text
    ? render(template.body_text, input.vars)
    : undefined;
  const recipients = Array.isArray(input.to) ? input.to : [input.to];

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await logDelivery({
      templateKey: input.templateKey,
      recipient: recipients.join(","),
      subject,
      status: "failed",
      error: "RESEND_API_KEY not configured",
      bookingId: input.bookingId,
      leadId: input.leadId,
    });
    return { ok: false, error: "Email not configured" };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromAddress(settings),
      to: recipients,
      replyTo: settings.reply_to,
      subject,
      html,
      text,
      attachments: input.ics
        ? [
            {
              filename: input.ics.filename,
              content: Buffer.from(input.ics.content).toString("base64"),
              contentType: `text/calendar; method=${input.ics.method ?? "REQUEST"}; charset=UTF-8`,
            },
          ]
        : undefined,
    });

    if (result.error) {
      await logDelivery({
        templateKey: input.templateKey,
        recipient: recipients.join(","),
        subject,
        status: "failed",
        error: result.error.message,
        bookingId: input.bookingId,
        leadId: input.leadId,
      });
      // Notify internal of failure
      await sendInternalFailure(result.error.message, input.leadId, input.bookingId);
      return { ok: false, error: result.error.message };
    }

    await logDelivery({
      templateKey: input.templateKey,
      recipient: recipients.join(","),
      subject,
      status: "sent",
      providerId: result.data?.id,
      bookingId: input.bookingId,
      leadId: input.leadId,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    await logDelivery({
      templateKey: input.templateKey,
      recipient: recipients.join(","),
      subject,
      status: "failed",
      error: message,
      bookingId: input.bookingId,
      leadId: input.leadId,
    });
    return { ok: false, error: message };
  }
}

async function sendInternalFailure(
  error: string,
  leadId?: string,
  bookingId?: string
) {
  try {
    const settings = await getSettings();
    const to =
      (settings.internal_notification_emails as string[])?.[0] ||
      DEFAULT_CONTACT_TO_EMAIL;
    await sendTemplatedEmail({
      templateKey: "internal_email_failed",
      to,
      vars: { error },
      leadId,
      bookingId,
    });
  } catch {
    /* avoid recursion loops */
  }
}

export async function sendInternalNotification(
  templateKey: string,
  vars: TemplateVars,
  opts?: { leadId?: string; bookingId?: string }
) {
  const settings = await getSettings();
  const emails =
    (settings.internal_notification_emails as string[])?.length
      ? (settings.internal_notification_emails as string[])
      : [DEFAULT_CONTACT_TO_EMAIL];
  return sendTemplatedEmail({
    templateKey,
    to: emails,
    vars: {
      ...vars,
      admin_lead_url: vars.admin_lead_url || `${siteUrl()}/admin?tab=leads`,
      admin_booking_url:
        vars.admin_booking_url || `${siteUrl()}/admin?tab=scheduling`,
      book_url: `${siteUrl()}/book`,
    },
    leadId: opts?.leadId,
    bookingId: opts?.bookingId,
  });
}

export function buildBookingIcsAttachment(input: {
  uid: string;
  sequence: number;
  title: string;
  description: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  attendeeEmail: string;
  attendeeName: string;
  manageUrl: string;
  cancelled?: boolean;
}) {
  const content = buildIcs({
    uid: input.uid,
    sequence: input.sequence,
    title: input.title,
    description: `${input.description}\n\nManage: ${input.manageUrl}`,
    location: input.location,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    organizerEmail: DEFAULT_CONTACT_TO_EMAIL,
    organizerName: "Redmont Strategies Group",
    attendeeEmail: input.attendeeEmail,
    attendeeName: input.attendeeName,
    status: input.cancelled ? "CANCELLED" : "CONFIRMED",
    method: input.cancelled ? "CANCEL" : "REQUEST",
    url: input.manageUrl,
  });
  return {
    filename: "consultation.ics",
    content,
    method: input.cancelled ? "CANCEL" : "REQUEST",
  };
}

export function signWebhookPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}
