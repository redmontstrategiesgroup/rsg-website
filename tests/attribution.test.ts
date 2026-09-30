import test from "node:test";
import assert from "node:assert/strict";
import { parseFirstTouch } from "../lib/first-touch.ts";
import { leadToRow } from "../lib/leads.ts";
import type { Lead } from "../lib/types.ts";

const encode = (v: unknown) => encodeURIComponent(JSON.stringify(v));

test("parseFirstTouch decodes the compact rsg_ft cookie", () => {
  const ft = parseFirstTouch(
    encode({
      s: "linkedin",
      m: "paid",
      c: "fall-launch",
      n: "",
      t: "",
      r: "www.linkedin.com",
      l: "/services",
      a: "2026-09-20T14:00:00.000Z",
    })
  );
  assert.deepEqual(ft, {
    utmSource: "linkedin",
    utmMedium: "paid",
    utmCampaign: "fall-launch",
    utmContent: "",
    utmTerm: "",
    referrer: "www.linkedin.com",
    landingPage: "/services",
    at: "2026-09-20T14:00:00.000Z",
  });
});

test("parseFirstTouch rejects malformed or hostile values", () => {
  assert.equal(parseFirstTouch(undefined), undefined);
  assert.equal(parseFirstTouch("not-json"), undefined);
  assert.equal(parseFirstTouch(encode([1, 2])), undefined);
  assert.equal(parseFirstTouch(encode({ s: "x" })), undefined, "missing timestamp");
  assert.equal(parseFirstTouch(encode({ a: "yesterday" })), undefined, "bad timestamp");
  assert.equal(parseFirstTouch("x".repeat(3001)), undefined, "oversized");

  const ft = parseFirstTouch(
    encode({ s: { $ne: 1 }, l: "https://evil.example/", c: "y".repeat(500), a: "2026-09-20" })
  );
  assert.equal(ft?.utmSource, "", "non-string fields become empty");
  assert.equal(ft?.landingPage, "", "landing page must be a site path");
  assert.equal(ft?.utmCampaign.length, 200, "fields are length-capped");
});

test("leadToRow writes visitor_id and first_touch (null when absent)", () => {
  const lead: Lead = {
    name: "Jordan Lee",
    company: "South Shore Clinic",
    email: "jordan@example.com",
    phone: "",
    website: "",
    industry: "",
    problem: "x",
    improve: "",
    submittedAt: "2026-09-29T12:00:00.000Z",
  };
  const bare = leadToRow(lead);
  assert.equal(bare.visitor_id, null);
  assert.equal(bare.first_touch, null);

  const firstTouch = parseFirstTouch(encode({ s: "google", a: "2026-09-01T00:00:00Z" }));
  const row = leadToRow({ ...lead, visitorId: "abc-123", firstTouch });
  assert.equal(row.visitor_id, "abc-123");
  assert.deepEqual(row.first_touch, firstTouch);
});
