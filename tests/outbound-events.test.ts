import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EVENT_CATALOG, EVENT_TYPES, SLACK_DEFAULT_EVENTS, isEventType } from "../lib/webhooks/catalog.ts";
import { escapeSlack, slackMessage } from "../lib/webhooks/slack.ts";
import {
  dialWasAnswered,
  escapeXml,
  isE164,
  optOutType,
  twilioSignature,
  twimlForward,
  twimlVoicemail,
  verifyTwilioSignature,
} from "../lib/twilio/webhook.ts";

// ---------------------------------------------------------------- catalog

test("every catalog event has a group, description and camelCase fields", () => {
  for (const type of EVENT_TYPES) {
    const spec = EVENT_CATALOG[type];
    assert.match(type, /^[a-z_]+\.[a-z_]+$/, type);
    assert.ok(spec.group && spec.description, type);
    for (const f of spec.fields) assert.match(f, /^[a-z][A-Za-z]*$/, `${type}.${f}`);
  }
  assert.ok(isEventType("lead.created"));
  assert.ok(!isEventType("lead.nope"));
});

test("Slack defaults are the people-facing events, not the noisy ones", () => {
  assert.ok(SLACK_DEFAULT_EVENTS.includes("lead.created"));
  assert.ok(SLACK_DEFAULT_EVENTS.includes("voicemail.received"));
  assert.ok(!SLACK_DEFAULT_EVENTS.includes("reminder.due"));
  assert.ok(!SLACK_DEFAULT_EVENTS.includes("recording.synced"));
});

test("docs/webhooks.md documents every catalog event (and no unknown ones)", () => {
  const doc = readFileSync(new URL("../docs/webhooks.md", import.meta.url), "utf8");
  for (const type of EVENT_TYPES) assert.ok(doc.includes(`\`${type}\``), `missing from docs: ${type}`);
  const documented = [...doc.matchAll(/^\| `([a-z_]+\.[a-z_]+)` \|/gm)].map((m) => m[1]);
  for (const type of documented) assert.ok(isEventType(type), `documented but not in catalog: ${type}`);
});

test("every emitEvent call in the code uses a catalog event type", () => {
  const files = [
    "lib/leads.ts",
    "lib/lead-ai/index.ts",
    "lib/lifecycle/orchestrate.ts",
    "lib/pocket/recordings.ts",
    "app/api/admin/leads/[id]/route.ts",
    "app/api/subscribe/route.ts",
    "app/api/unsubscribe/route.ts",
    "app/api/resend/webhook/route.ts",
    "app/api/cal/webhook/route.ts",
    "app/api/stripe/webhook/route.ts",
    "app/api/twilio/sms/route.ts",
    "app/api/twilio/voice/route.ts",
    "app/api/twilio/voice/status/route.ts",
    "app/api/twilio/voice/recording/route.ts",
  ];
  let seen = 0;
  for (const file of files) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    // First argument only: a literal, or a ternary between literals.
    for (const m of src.matchAll(/emitEvent\(\s*([^,]+),/g)) {
      const types = [...m[1].matchAll(/"([a-z_]+\.[a-z_]+)"/g)].map((t) => t[1]);
      assert.ok(types.length, `${file}: emitEvent with a non-literal type: ${m[1].trim()}`);
      for (const t of types) assert.ok(isEventType(t), `${file}: ${t}`);
      seen += types.length;
    }
  }
  assert.ok(seen >= 30, `expected the emit sites to be found, saw ${seen}`);
});

// ---------------------------------------------------------------- Slack

test("slackMessage escapes visitor-controlled text", () => {
  assert.equal(escapeSlack("<!channel> & <https://evil|x>"), "&lt;!channel&gt; &amp; &lt;https://evil|x&gt;");
  const msg = slackMessage("lead.created", { name: "<!channel>", email: "a@b.co", message: "<http://x|y>" });
  const json = JSON.stringify(msg);
  assert.ok(!json.includes("<!channel>"));
  assert.ok(!json.includes("<http://x|y>"));
  assert.match(msg.text, /^New lead: &lt;!channel&gt;$/);
});

test("slackMessage formats money, skips empty fields and links the admin", () => {
  const msg = slackMessage(
    "invoice.paid",
    { invoiceId: "in_1", amountCents: 125000, currency: "usd", payerEmail: "" },
    "https://example.com/admin",
  );
  const body = JSON.stringify(msg.blocks);
  assert.ok(body.includes("$1250.00"));
  assert.ok(!body.includes("Payer email"));
  assert.ok(body.includes("<https://example.com/admin|Open admin console>"));
  assert.equal(msg.text, "Invoice paid");
});

test("slackMessage falls back to raw fields for unknown events", () => {
  const msg = slackMessage("custom.thing", { foo: "bar" });
  assert.ok(JSON.stringify(msg.blocks).includes("bar"));
});

// ---------------------------------------------------------------- Twilio

test("twilioSignature matches Twilio's documented example", () => {
  const params = {
    Digits: "1234",
    To: "+18005551212",
    From: "+14158675310",
    Caller: "+14158675310",
    CallSid: "CA1234567890ABCDE",
  };
  const url = "https://example.com/myapp.php?foo=1&bar=2";
  assert.equal(twilioSignature("12345", url, params), "L/OH5YylLD5NRKLltdqwSvS0BnU=");
  assert.equal(
    verifyTwilioSignature({ authToken: "12345", url, params, signature: "L/OH5YylLD5NRKLltdqwSvS0BnU=" }),
    true,
  );
  assert.equal(verifyTwilioSignature({ authToken: "12345", url, params: { ...params, Digits: "9" }, signature: "L/OH5YylLD5NRKLltdqwSvS0BnU=" }), false);
  assert.equal(verifyTwilioSignature({ authToken: "12345", url: url + "&x=1", params, signature: "L/OH5YylLD5NRKLltdqwSvS0BnU=" }), false);
  assert.equal(verifyTwilioSignature({ authToken: "", url, params, signature: "L/OH5YylLD5NRKLltdqwSvS0BnU=" }), false);
  assert.equal(verifyTwilioSignature({ authToken: "12345", url, params, signature: null }), false);
});

test("TwiML builders escape input and clamp limits", () => {
  const fwd = twimlForward({ to: "+15555550100", actionUrl: "https://x.co/a?b=1&c=2", timeoutSeconds: 999 });
  assert.ok(fwd.includes('timeout="60"'));
  assert.ok(fwd.includes("https://x.co/a?b=1&amp;c=2"));
  assert.ok(fwd.includes("<Number>+15555550100</Number>"));
  const vm = twimlVoicemail({ greeting: "Hi <there> & bye", callbackUrl: "https://x.co/r?from=%2B1" });
  assert.ok(vm.includes("<Say>Hi &lt;there&gt; &amp; bye</Say>"));
  assert.ok(vm.includes('recordingStatusCallback="https://x.co/r?from=%2B1"'));
  assert.equal(escapeXml(`"'`), "&quot;&apos;");
});

test("Twilio helpers: E.164, dial outcome, opt-out type", () => {
  assert.ok(isE164("+15555550100"));
  assert.ok(!isE164("5555550100"));
  assert.ok(!isE164("+1 555 555 0100"));
  assert.ok(!isE164(undefined));
  assert.ok(dialWasAnswered("completed"));
  assert.ok(!dialWasAnswered("no-answer"));
  assert.ok(!dialWasAnswered("busy"));
  assert.ok(!dialWasAnswered(undefined));
  assert.equal(optOutType({ OptOutType: "stop" }), "STOP");
  assert.equal(optOutType({ OptOutType: "START" }), "START");
  assert.equal(optOutType({ Body: "STOP" }), null);
});
