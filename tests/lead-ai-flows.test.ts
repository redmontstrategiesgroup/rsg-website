import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLead, type AnalyzeDeps, type GenerateResult } from "../lib/lead-ai/analyze.ts";
import type { NewInsight } from "../lib/lead-ai/types.ts";
import type { Lead } from "../lib/types.ts";

function baseLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    name: "Dana Ruiz",
    company: "Glow Med Spa",
    email: "dana@example.com",
    phone: "555-0100",
    website: "",
    industry: "Med spa",
    problem: "We miss calls after 6pm.",
    improve: "After-hours follow-up.",
    submittedAt: "2026-09-30T12:00:00.000Z",
    status: "new",
    score: 52,
    ruleScore: 52,
    ...overrides,
  };
}

const goodOutput = {
  ai_fit_score: 84,
  adjustment: 30, // out of range on purpose: must be clamped to 20
  rationale: "Specific after-hours problem, acting this month.",
  signals: { positive: ["specific problem"], negative: [] },
  red_flags: [],
  draft: {
    subject: "After-hours calls",
    body: "Hi Dana, pick a time at {{BOOKING_LINK}} or see https://evil.example.",
  },
};

function makeDeps(over: Partial<AnalyzeDeps> = {}) {
  const inserted: NewInsight[] = [];
  const updates: unknown[] = [];
  const generateCalls: { system: string; message: string }[] = [];
  const deps: AnalyzeDeps = {
    loadLead: async () => baseLead(),
    generate: async (req): Promise<GenerateResult> => {
      generateCalls.push(req);
      return { output: goodOutput, model: "claude-sonnet-5", inputTokens: 1500, outputTokens: 400 };
    },
    insertInsight: async (row) => {
      inserted.push(row);
      return `ins-${inserted.length}`;
    },
    updateLeadAi: async (u) => {
      updates.push(u);
    },
    model: "claude-sonnet-5",
    bookingUrl: "https://rsg.example/book",
    signature: "Joseph\nRSG",
    ...over,
  };
  return { deps, inserted, updates, generateCalls };
}

test("analyzeLead stores an ok insight with clamped adjustment and composed draft", async () => {
  const { deps, inserted, updates, generateCalls } = makeDeps();
  const r = await analyzeLead("lead-1", deps);
  assert.deepEqual(r, { ok: true, insightId: "ins-1" });
  assert.equal(inserted.length, 1);
  const row = inserted[0];
  assert.equal(row.status, "ok");
  assert.equal(row.adjustment, 20);
  assert.equal(row.aiFitScore, 84);
  assert.equal(row.promptVersion, "lead-ai-v1");
  assert.equal(row.draftSubject, "After-hours calls");
  assert.match(row.draftBody!, /https:\/\/rsg\.example\/book/);
  assert.doesNotMatch(row.draftBody!, /evil\.example/);
  assert.ok(row.draftBody!.endsWith("Joseph\nRSG"));
  assert.equal(row.inputTokens, 1500);
  assert.deepEqual(updates, [{ leadId: "lead-1", aiScore: 84, insightId: "ins-1" }]);
  assert.match(generateCalls[0].message, /^Rule-based score: 52 \/ 100/);
});

test("analyzeLead falls back to lead.score when ruleScore is absent", async () => {
  const { deps, generateCalls } = makeDeps({
    loadLead: async () => baseLead({ ruleScore: undefined, score: 61 }),
  });
  await analyzeLead("lead-1", deps);
  assert.match(generateCalls[0].message, /^Rule-based score: 61 /);
});

test("vendor_pitch or spam drops the draft even if the model wrote one", async () => {
  const { deps, inserted } = makeDeps({
    generate: async () => ({
      output: { ...goodOutput, red_flags: ["vendor_pitch"] },
      model: "claude-sonnet-5",
      inputTokens: 1,
      outputTokens: 1,
    }),
  });
  const r = await analyzeLead("lead-1", deps);
  assert.equal(r.ok, true);
  assert.equal(inserted[0].draftSubject, null);
  assert.equal(inserted[0].draftBody, null);
  assert.deepEqual(inserted[0].redFlags, ["vendor_pitch"]);
});

test("a generate failure writes a failed row and resolves", async () => {
  const { deps, inserted, updates } = makeDeps({
    generate: async () => {
      throw new Error("AI request failed: timeout");
    },
  });
  const r = await analyzeLead("lead-1", deps);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason, "failed");
    assert.equal(r.insightId, "ins-1");
  }
  assert.equal(inserted[0].status, "failed");
  assert.equal(inserted[0].error, "AI request failed: timeout");
  assert.equal(inserted[0].inputTokens, null);
  assert.equal(updates.length, 0);
});

test("invalid model output writes a failed row with token counts", async () => {
  const { deps, inserted } = makeDeps({
    generate: async () => ({
      output: { nonsense: true },
      model: "claude-sonnet-5",
      inputTokens: 900,
      outputTokens: 12,
    }),
  });
  const r = await analyzeLead("lead-1", deps);
  assert.equal(r.ok, false);
  assert.match(inserted[0].error!, /^Invalid model output/);
  assert.equal(inserted[0].outputTokens, 12);
});

test("missing lead → not_found without calling the model", async () => {
  const { deps, generateCalls, inserted } = makeDeps({ loadLead: async () => null });
  assert.deepEqual(await analyzeLead("nope", deps), { ok: false, reason: "not_found" });
  assert.equal(generateCalls.length, 0);
  assert.equal(inserted.length, 0);
});

test("spam and archived leads are skipped", async () => {
  for (const status of ["spam", "archived"] as const) {
    const { deps, generateCalls } = makeDeps({ loadLead: async () => baseLead({ status }) });
    assert.deepEqual(await analyzeLead("lead-1", deps), { ok: false, reason: "skipped" });
    assert.equal(generateCalls.length, 0);
  }
});

test("analyzeLead never rejects, even when storage throws everywhere", async () => {
  const boom = async () => {
    throw new Error("db down");
  };
  const loadFails = makeDeps({ loadLead: boom });
  const r1 = await analyzeLead("lead-1", loadFails.deps);
  assert.equal(r1.ok, false);

  const insertFails = makeDeps({ insertInsight: boom });
  const r2 = await analyzeLead("lead-1", insertFails.deps);
  assert.equal(r2.ok, false);

  const failPathInsertFails = makeDeps({
    insertInsight: boom,
    generate: async () => {
      throw new Error("x");
    },
  });
  const r3 = await analyzeLead("lead-1", failPathInsertFails.deps);
  assert.equal(r3.ok, false);
});
