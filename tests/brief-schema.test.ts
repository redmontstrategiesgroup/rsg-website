import test from "node:test";
import assert from "node:assert/strict";
import { BriefPayloadSchema } from "../lib/briefs/schema.ts";

const valid = {
  title: "RSG Daily Executive Intelligence Brief",
  briefDate: "2026-07-12",
  executiveSummary: "Five developments require review.",
  contentMarkdown: "# Full Brief",
};

test("normalizes a minimal valid brief", () => {
  const result = BriefPayloadSchema.parse(valid);
  assert.equal(result.briefType, "daily_executive");
  assert.equal(result.priority, "medium");
  assert.deepEqual(result.actions, []);
});

test("rejects malformed dates and missing titles", () => {
  const result = BriefPayloadSchema.safeParse({ ...valid, title: "", briefDate: "07/12/2026" });
  assert.equal(result.success, false);
});

test("rejects out-of-range AI extraction scores", () => {
  const result = BriefPayloadSchema.safeParse({
    ...valid,
    opportunities: [{ name: "Local automation offer", confidenceScore: 101 }],
  });
  assert.equal(result.success, false);
});

test("accepts timezone-aware generation timestamps", () => {
  const result = BriefPayloadSchema.safeParse({ ...valid, generatedAt: "2026-07-12T08:00:00-04:00" });
  assert.equal(result.success, true);
});
