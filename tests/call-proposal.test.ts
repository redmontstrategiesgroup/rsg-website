import test from "node:test";
import assert from "node:assert/strict";
import {
  DRAFT_TOOL,
  EXTRACT_TOOL,
  parseDraftOutput,
  parseExtractOutput,
} from "../lib/call-proposal/schema.ts";
import { draftOut, extractOut } from "./fixtures/call-proposal.ts";

test("schema: valid extract output parses", () => {
  const r = parseExtractOutput(extractOut);
  assert.equal(r.ok, true);
});

test("schema: extract output missing summary is rejected with a readable error", () => {
  const { summary: _drop, ...rest } = extractOut;
  const r = parseExtractOutput(rest);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /Invalid model output: summary/);
});

test("schema: bad target_date format is rejected", () => {
  const bad = { ...extractOut, timeline: { ...extractOut.timeline, target_date: "next spring" } };
  assert.equal(parseExtractOutput(bad).ok, false);
});

test("schema: valid draft output parses", () => {
  assert.equal(parseDraftOutput(draftOut).ok, true);
});

test("schema: tool definitions are plain object JSON schemas", () => {
  for (const tool of [EXTRACT_TOOL, DRAFT_TOOL]) {
    assert.equal(tool.input_schema.type, "object");
    assert.equal("$schema" in tool.input_schema, false);
  }
  assert.equal(EXTRACT_TOOL.name, "record_call_brief");
  assert.equal(DRAFT_TOOL.name, "record_proposal_draft");
});
