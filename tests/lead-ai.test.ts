import test from "node:test";
import assert from "node:assert/strict";
import {
  blendScore,
  bucketOf,
  clamp,
  crossedIntoHot,
} from "../lib/lead-ai/blend.ts";
import { LEAD_AI_TOOL, parseLeadAiOutput } from "../lib/lead-ai/schema.ts";

const validOutput = {
  ai_fit_score: 82,
  adjustment: 12,
  rationale: "Owner-led med spa losing after-hours inquiries; wants a fix this month.",
  signals: { positive: ["specific problem", "urgent timeline"], negative: [] },
  red_flags: [],
  draft: { subject: "Your after-hours inquiries", body: "Hi Dana, thanks for reaching out." },
};

test("clamp and blendScore stay within bounds", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(12.6, 0, 10), 10);
  assert.equal(blendScore(60, 15), 75);
  assert.equal(blendScore(95, 20), 100);
  assert.equal(blendScore(10, -20), 0);
  // Adjustment beyond ±20 is clamped before blending.
  assert.equal(blendScore(50, 40), 70);
  assert.equal(blendScore(50, -40), 30);
});

test("bucketOf uses the hot/warm thresholds", () => {
  assert.equal(bucketOf(70), "hot");
  assert.equal(bucketOf(69), "warm");
  assert.equal(bucketOf(45), "warm");
  assert.equal(bucketOf(44), "cold");
});

test("crossedIntoHot only fires on an upward crossing", () => {
  assert.equal(crossedIntoHot(65, 72), true);
  assert.equal(crossedIntoHot(72, 80), false);
  assert.equal(crossedIntoHot(72, 60), false);
  assert.equal(crossedIntoHot(40, 69), false);
});

test("parseLeadAiOutput accepts a valid assessment", () => {
  const r = parseLeadAiOutput(validOutput);
  assert.equal(r.ok, true);
});

test("parseLeadAiOutput accepts a null draft and an out-of-range adjustment", () => {
  const r = parseLeadAiOutput({ ...validOutput, adjustment: 35, draft: null });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.draft, null);
});

test("parseLeadAiOutput rejects malformed output", () => {
  for (const bad of [
    { ...validOutput, ai_fit_score: 101 },
    { ...validOutput, ai_fit_score: 50.5 },
    { ...validOutput, red_flags: ["made_up_flag"] },
    { ...validOutput, rationale: "" },
    (() => {
      const { draft, ...rest } = validOutput;
      return rest;
    })(),
    "not an object",
    null,
  ]) {
    const r = parseLeadAiOutput(bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
    if (!r.ok) assert.match(r.error, /^Invalid model output/);
  }
});

test("LEAD_AI_TOOL carries an object JSON schema without $schema", () => {
  const schema = LEAD_AI_TOOL.input_schema as Record<string, unknown>;
  assert.equal(schema.type, "object");
  assert.equal("$schema" in schema, false);
  const props = schema.properties as Record<string, unknown>;
  for (const key of ["ai_fit_score", "adjustment", "rationale", "signals", "red_flags", "draft"]) {
    assert.ok(key in props, `missing property ${key}`);
  }
});
