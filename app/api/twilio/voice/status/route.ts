import { emitEvent } from "@/lib/webhooks/emit";
import { publicUrl, readTwilioRequest, twiml, voicemailGreeting } from "@/lib/twilio/request";
import { dialWasAnswered, twimlHangup, twimlVoicemail } from "@/lib/twilio/webhook";

export const runtime = "nodejs";

/**
 * <Dial action> for forwarded calls. Answered: hang up cleanly. Not answered
 * (busy, no-answer, failed): publish call.missed and offer voicemail.
 * Configured automatically by /api/twilio/voice; nothing to set in Twilio.
 */
export async function POST(request: Request) {
  const auth = await readTwilioRequest(request, "voice.status");
  if (auth instanceof Response) return auth;
  const p = auth.params;

  if (dialWasAnswered(p.DialCallStatus)) return twiml(twimlHangup());

  const callSid = p.CallSid ?? "";
  const from = p.From ?? "";
  if (callSid) {
    await emitEvent(
      "call.missed",
      { callSid, from, dialStatus: p.DialCallStatus ?? "unknown" },
      { eventId: `call.missed:${callSid}` }
    );
  }
  return twiml(
    twimlVoicemail({
      greeting: voicemailGreeting(),
      callbackUrl: publicUrl("/api/twilio/voice/recording", { from }),
    })
  );
}
