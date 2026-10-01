import { emitEvent } from "@/lib/webhooks/emit";
import { readTwilioRequest } from "@/lib/twilio/request";

export const runtime = "nodejs";

/**
 * recordingStatusCallback for voicemails. Set by the TwiML this site returns;
 * nothing to configure in Twilio. `from` rides in the query string because
 * the callback does not carry the caller's number; it is covered by the
 * signature, so it cannot be forged.
 *
 * The recording URL needs Twilio credentials to fetch when "HTTP Basic
 * authentication for media" is on (recommended), so it is safe to forward.
 */
export async function POST(request: Request) {
  const auth = await readTwilioRequest(request, "voice.recording");
  if (auth instanceof Response) return auth;
  const p = auth.params;

  if (p.RecordingStatus === "completed" && p.RecordingSid) {
    const from = new URL(request.url).searchParams.get("from") ?? "";
    await emitEvent(
      "voicemail.received",
      {
        callSid: p.CallSid ?? "",
        recordingSid: p.RecordingSid,
        from,
        recordingUrl: p.RecordingUrl ? `${p.RecordingUrl}.mp3` : "",
        durationSeconds: Number(p.RecordingDuration ?? 0) || 0,
      },
      { eventId: `voicemail.received:${p.RecordingSid}` }
    );
  }
  return new Response(null, { status: 204 });
}
