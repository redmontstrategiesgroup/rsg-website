import { emitEvent } from "@/lib/webhooks/emit";
import { publicUrl, readTwilioRequest, twiml, voicemailGreeting } from "@/lib/twilio/request";
import { isE164, twimlForward, twimlVoicemail } from "@/lib/twilio/webhook";

export const runtime = "nodejs";

/**
 * Incoming calls (Twilio number -> Voice -> "A call comes in":
 * POST https://<site>/api/twilio/voice).
 *
 * Rings TWILIO_FORWARD_TO (E.164) for 20 seconds; /api/twilio/voice/status
 * takes over if nobody answers. Without a forwarding number the caller goes
 * straight to voicemail.
 */
export async function POST(request: Request) {
  const auth = await readTwilioRequest(request, "voice");
  if (auth instanceof Response) return auth;
  const p = auth.params;
  const callSid = p.CallSid ?? "";
  const from = p.From ?? "";

  if (callSid) {
    await emitEvent(
      "call.received",
      { callSid, from, to: p.To ?? "" },
      { eventId: `call.received:${callSid}` }
    );
  }

  const forwardTo = process.env.TWILIO_FORWARD_TO?.trim();
  if (isE164(forwardTo)) {
    return twiml(twimlForward({ to: forwardTo, actionUrl: publicUrl("/api/twilio/voice/status") }));
  }
  return twiml(
    twimlVoicemail({
      greeting: voicemailGreeting(),
      callbackUrl: publicUrl("/api/twilio/voice/recording", { from }),
    })
  );
}
