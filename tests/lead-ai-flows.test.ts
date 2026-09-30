import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLead, type AnalyzeDeps, type GenerateResult } from "../lib/lead-ai/analyze.ts";
import type { LeadInsight, NewInsight } from "../lib/lead-ai/types.ts";
import type { Lead } from "../lib/types.ts";
import { sendLeadReply, type ReplyDeps, type ReplyEmail } from "../lib/lead-ai/reply.ts";

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
  const notified: unknown[] = [];
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
    notifyHotUpgrade: async (e) => {
      notified.push(e);
    },
    model: "claude-sonnet-5",
    bookingUrl: "https://rsg.example/book",
    signature: "Joseph\nRSG",
    ...over,
  };
  return { deps, inserted, updates, generateCalls, notified };
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
  // rule 52 + clamped 20 = 72
  assert.deepEqual(updates, [{ leadId: "lead-1", aiScore: 84, insightId: "ins-1", leadScore: 72 }]);
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
  for (const flag of ["vendor_pitch", "spam"] as const) {
    const { deps, inserted } = makeDeps({
      generate: async () => ({
        output: { ...goodOutput, red_flags: [flag] },
        model: "claude-sonnet-5",
        inputTokens: 1,
        outputTokens: 1,
      }),
    });
    const r = await analyzeLead("lead-1", deps);
    assert.equal(r.ok, true);
    assert.equal(inserted[0].draftSubject, null);
    assert.equal(inserted[0].draftBody, null);
    assert.deepEqual(inserted[0].redFlags, [flag]);
  }
});

test("the stored draft subject has links stripped", async () => {
  const { deps, inserted } = makeDeps({
    generate: async () => ({
      output: { ...goodOutput, draft: { subject: "See evil.com now", body: "Hi" } },
      model: "claude-sonnet-5",
      inputTokens: 1,
      outputTokens: 1,
    }),
  });
  await analyzeLead("lead-1", deps);
  assert.ok(!inserted[0].draftSubject?.includes("evil.com"));
  assert.equal(inserted[0].draftSubject, "See now");
});

test("an all-link subject falls back to a neutral one", async () => {
  const { deps, inserted } = makeDeps({
    generate: async () => ({
      output: { ...goodOutput, draft: { subject: "https://evil.example/x", body: "Hi" } },
      model: "claude-sonnet-5",
      inputTokens: 1,
      outputTokens: 1,
    }),
  });
  await analyzeLead("lead-1", deps);
  assert.equal(inserted[0].draftSubject, "Following up on your inquiry");
});

test("a provided redact dep is applied to the failed row's error", async () => {
  const { deps, inserted } = makeDeps({
    generate: async () => {
      throw new Error("bad key sk-secret-123");
    },
    redact: (s) => s.replace(/sk-\S+/g, "[redacted]"),
  });
  const r = await analyzeLead("lead-1", deps);
  assert.equal(inserted[0].error, "bad key [redacted]");
  assert.ok(!r.ok && r.error === "bad key [redacted]");
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
  assert.equal(r1.reason, "failed");

  const insertFails = makeDeps({ insertInsight: boom });
  const r2 = await analyzeLead("lead-1", insertFails.deps);
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, "failed");

  const failPathInsertFails = makeDeps({
    insertInsight: boom,
    generate: async () => {
      throw new Error("x");
    },
  });
  const r3 = await analyzeLead("lead-1", failPathInsertFails.deps);
  assert.equal(r3.ok, false);
  assert.equal(r3.reason, "failed");
});

test("updateLeadAi failure keeps insightId in result", async () => {
  const { deps, inserted, updates, notified } = makeDeps({
    updateLeadAi: async () => {
      throw new Error("db down");
    },
  });
  const r = await analyzeLead("lead-1", deps);
  assert.deepEqual(r, { ok: false, reason: "failed", insightId: "ins-1", error: "db down" });
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].status, "ok");
  assert.equal(updates.length, 0);
  assert.equal(notified.length, 0); // no hot alert when the lead was not updated
});

test("generate resolves undefined → returns failed result without rejecting", async () => {
  const { deps, inserted } = makeDeps({
    generate: async () => undefined as unknown as GenerateResult,
  });
  const r = await analyzeLead("lead-1", deps);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "failed");
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].status, "failed");
  assert.equal(inserted[0].error, "AI returned no result");
});

function insight(over: Partial<LeadInsight> = {}): LeadInsight {
  return {
    id: "ins-1", leadId: "lead-1", createdAt: "2026-09-30T12:00:00Z",
    model: "claude-sonnet-5", promptVersion: "lead-ai-v1", status: "ok", error: null,
    aiFitScore: 80, adjustment: 10, rationale: "r", signals: { positive: [], negative: [] },
    redFlags: [], draftSubject: "Hi", draftBody: "Draft", sentAt: null, sentBy: null,
    sentSubject: null, sentBody: null, inputTokens: 1, outputTokens: 1,
    ...over,
  };
}

function replyDeps(over: Partial<ReplyDeps> = {}) {
  const calls = { claimed: 0, released: 0, completed: [] as string[][], emails: [] as ReplyEmail[], contacted: [] as string[] };
  const deps: ReplyDeps = {
    getLead: async () => baseLead(),
    getInsight: async () => insight(),
    claimSend: async () => {
      calls.claimed += 1;
      return calls.claimed === 1; // a second claim loses, like the DB guard
    },
    releaseSend: async () => {
      calls.released += 1;
    },
    completeSend: async (_id, subject, body) => {
      calls.completed.push([subject, body]);
    },
    sendEmail: async (msg) => {
      calls.emails.push(msg);
    },
    markContacted: async (id) => {
      calls.contacted.push(id);
    },
    ...over,
  };
  return { deps, calls };
}

const input = { leadId: "lead-1", insightId: "ins-1", subject: "  Your calls ", body: "Hi <Dana>\n\nThanks", adminId: "admin-1" };

test("sendLeadReply sends once, records it, and marks a new lead contacted", async () => {
  const { deps, calls } = replyDeps();
  const r = await sendLeadReply(input, deps);
  assert.equal(r.ok, true);
  assert.equal(calls.emails.length, 1);
  assert.equal(calls.emails[0].to, "dana@example.com");
  assert.equal(calls.emails[0].subject, "Your calls");
  assert.equal(calls.emails[0].text, "Hi <Dana>\n\nThanks");
  assert.match(calls.emails[0].html, /Hi &lt;Dana&gt;/);
  assert.deepEqual(calls.completed, [["Your calls", "Hi <Dana>\n\nThanks"]]);
  assert.deepEqual(calls.contacted, ["lead-1"]);
  if (r.ok) {
    assert.ok(r.insight.sentAt);
    assert.equal(r.insight.sentBy, "admin-1");
    assert.equal(r.insight.sentBody, "Hi <Dana>\n\nThanks");
  }
});

test("a second send attempt gets 409 and sends nothing", async () => {
  const { deps, calls } = replyDeps();
  await sendLeadReply(input, deps);
  const second = await sendLeadReply(input, deps);
  assert.deepEqual(second, { ok: false, status: 409, error: "This reply was already sent." });
  assert.equal(calls.emails.length, 1);
});

test("a failed email releases the claim so it can be retried", async () => {
  const { deps, calls } = replyDeps({
    sendEmail: async () => {
      throw new Error("Resend 500");
    },
  });
  const r = await sendLeadReply(input, deps);
  assert.deepEqual(r, { ok: false, status: 502, error: "Resend 500" });
  assert.equal(calls.released, 1);
  assert.equal(calls.completed.length, 0);
  assert.equal(calls.contacted.length, 0);
});

test("a lead past 'new' keeps its status", async () => {
  const { deps, calls } = replyDeps({ getLead: async () => baseLead({ status: "qualified" }) });
  assert.equal((await sendLeadReply(input, deps)).ok, true);
  assert.equal(calls.contacted.length, 0);
});

test("reply guards: missing lead, foreign insight, no email, empty text", async () => {
  const cases: [Partial<ReplyDeps>, typeof input, number][] = [
    [{ getLead: async () => null }, input, 404],
    [{ getInsight: async () => null }, input, 404],
    [{ getInsight: async () => insight({ leadId: "other" }) }, input, 404],
    [{ getLead: async () => baseLead({ email: "" }) }, input, 422],
    [{}, { ...input, subject: "   " }, 422],
    [{}, { ...input, body: "\n \n" }, 422],
  ];
  for (const [over, inp, status] of cases) {
    const { deps, calls } = replyDeps(over);
    const r = await sendLeadReply(inp, deps);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, status);
    assert.equal(calls.emails.length, 0);
    assert.equal(calls.claimed, 0);
  }
});

test("markContacted or completeSend failing after a real send still reports success", async () => {
  const { deps, calls } = replyDeps({
    completeSend: async () => {
      throw new Error("db down");
    },
    markContacted: async () => {
      throw new Error("db down");
    },
  });
  const r = await sendLeadReply(input, deps);
  assert.equal(r.ok, true);
  assert.equal(calls.emails.length, 1);
  assert.equal(calls.released, 0); // the email went out: never release after sending
});

test("crossing into hot notifies once; staying hot does not", async () => {
  const up = makeDeps(); // lead.score 52 -> 72
  await analyzeLead("lead-1", up.deps);
  assert.equal(up.notified.length, 1);
  const alert = up.notified[0] as { before: number; after: number; rationale: string };
  assert.equal(alert.before, 52);
  assert.equal(alert.after, 72);
  assert.equal(alert.rationale, goodOutput.rationale);

  const alreadyHot = makeDeps({ loadLead: async () => baseLead({ ruleScore: 52, score: 72 }) });
  await analyzeLead("lead-1", alreadyHot.deps);
  assert.equal(alreadyHot.notified.length, 0);
});

test("regenerate re-blends from the rule score, not the previous blend", async () => {
  const { deps, updates } = makeDeps({
    loadLead: async () => baseLead({ ruleScore: 52, score: 72 }),
    generate: async () => ({
      output: { ...goodOutput, adjustment: -5 },
      model: "claude-sonnet-5",
      inputTokens: 1,
      outputTokens: 1,
    }),
  });
  await analyzeLead("lead-1", deps);
  assert.equal((updates[0] as { leadScore: number }).leadScore, 47);
});

test("a failing hot-upgrade alert does not fail the analysis", async () => {
  const { deps } = makeDeps({
    notifyHotUpgrade: async () => {
      throw new Error("resend down");
    },
  });
  assert.equal((await analyzeLead("lead-1", deps)).ok, true);
});
