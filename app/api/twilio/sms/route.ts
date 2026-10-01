import { emitEvent } from "@/lib/webhooks/emit";
import { readTwilioRequest, twiml } from "@/lib/twilio/request";
import { optOutType, twimlEmpty, twimlMessage } from "@/lib/twilio/webhook";

export const runtime = "nodejs";

/**
 * Incoming text messages (Twilio number -> Messaging -> "A message comes in":
 * POST https://<site>/api/twilio/sms).
 *
 * Publishes sms.received (Slack + subscribers). STOP / START / HELP are
 * handled by Twilio's own opt-out management; we only record them as
 * sms.opted_out and never auto-reply to them. Optional TWILIO_SMS_AUTO_REPLY
 * is sent to everything else. Twilio retries are collapsed by the
 * MessageSid-keyed event id.
 */
export async function POST(request: Request) {
  const auth = await readTwilioRequest(request, "sms");
  if (auth instanceof Response) return auth;
  const p = auth.params;
  const sid = p.MessageSid ?? p.SmsSid ?? "";
  if (!sid) return twiml(twimlEmpty());

  const optOut = optOutType(p);
  if (optOut) {
    await emitEvent(
      "sms.opted_out",
      { from: p.From ?? "", optOutType: optOut },
      { eventId: `sms.opted_out:${sid}` }
    );
    return twiml(twimlEmpty());
  }

  await emitEvent(
    "sms.received",
    { messageSid: sid, from: p.From ?? "", to: p.To ?? "", body: (p.Body ?? "").slice(0, 1600) },
    { eventId: `sms.received:${sid}` }
  );

  const autoReply = process.env.TWILIO_SMS_AUTO_REPLY?.trim();
  return twiml(autoReply ? twimlMessage(autoReply) : twimlEmpty());
}
