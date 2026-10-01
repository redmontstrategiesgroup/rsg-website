import test, { mock } from "node:test";
import assert from "node:assert/strict";
import {
  retryDraft,
  runCallProposal,
  runResultStatus,
  type PipelineDeps,
  type Stage,
} from "../lib/call-proposal/pipeline.ts";
import { RunInProgressError, type CallBriefRecord } from "../lib/call-proposal/types.ts";
import type { ProposalSection } from "../lib/lifecycle/types.ts";
import { baseSections, calls, draftOut, extractOut, lead } from "./fixtures/call-proposal.ts";

type Outputs = Record<Stage, unknown | (() => unknown)>;

function harness(over: Partial<PipelineDeps> = {}, outputs: Partial<Outputs> = {}) {
  const out: Outputs = { extract: extractOut, draft: draftOut, ...outputs };
  const briefs = new Map<string, CallBriefRecord>();
  const created: Parameters<PipelineDeps["createDraftProposal"]>[0][] = [];
  const saved: { id: string; sections: ProposalSection[] }[] = [];
  const proposals = new Map<string, ProposalSection[]>();
  let n = 0;
  const deps: PipelineDeps = {
    loadLead: async (id) => (id === "lead-1" ? lead : null),
    loadCalls: async () => calls,
    templates: [
      { key: "growth_systems", label: "Growth Systems" },
      { key: "business_systems", label: "Business Systems" },
    ],
    templateSections: () => baseSections.filter((s) => s.key !== "investment"),
    generate: async ({ stage }) => {
      const o = out[stage];
      return { output: typeof o === "function" ? (o as () => unknown)() : o, model: "m", inputTokens: 10, outputTokens: 5 };
    },
    failStaleRuns: async () => {},
    insertBrief: async (row) => {
      for (const b of briefs.values()) {
        if (b.leadId === row.leadId && (b.status === "extracting" || b.status === "drafting")) {
          throw new RunInProgressError();
        }
      }
      const id = `b${++n}`;
      briefs.set(id, {
        id, leadId: row.leadId, recordingIds: [], status: "extracting", failedStage: null, error: "",
        extraction: null, truncated: false, templateKey: null, termLength: "", proposalId: null,
        warnings: [], model: "", inputTokens: 0, outputTokens: 0, promptVersion: row.promptVersion,
        createdBy: row.createdBy, createdAt: "", updatedAt: "",
      });
      return id;
    },
    updateBrief: async (id, patch) => {
      const b = briefs.get(id)!;
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) (b as Record<string, unknown>)[k] = v;
    },
    getBrief: async (id) => briefs.get(id) ?? null,
    loadProposalSections: async (id) => proposals.get(id) ?? null,
    claimRetry: async (id) => {
      const b = briefs.get(id);
      if (!b || b.status !== "failed" || b.failedStage !== "draft") return false;
      Object.assign(b, { status: "drafting", failedStage: null, error: "" });
      return true;
    },
    createDraftProposal: async (input) => {
      created.push(input);
      const id = `p${created.length}`;
      proposals.set(id, structuredClone(baseSections));
      return { id, sections: structuredClone(baseSections) };
    },
    saveProposalSections: async (id, sections) => {
      saved.push({ id, sections });
    },
    ...over,
  };
  return { deps, briefs, created, saved };
}

test("pipeline: happy path extracts, drafts and saves a priced-at-zero draft", async () => {
  const h = harness();
  const r = await runCallProposal("lead-1", "joseph", h.deps);
  assert.deepEqual(r, { ok: true, briefId: "b1", proposalId: "p1" });
  const b = h.briefs.get("b1")!;
  assert.equal(b.status, "ready");
  assert.deepEqual(b.recordingIds, ["r1", "r2"]);
  assert.equal(b.extraction?.timeline?.evidence.verified, false);
  assert.equal(b.extraction?.budget?.low_cents, 500000);
  assert.equal(b.inputTokens, 20);
  assert.equal(b.outputTokens, 10);
  assert.equal(b.templateKey, "growth_systems");
  assert.equal(b.termLength, "about six weeks");
  assert.equal(b.proposalId, "p1");
  assert.deepEqual(b.warnings.map((w) => w.code), ["unverified_quotes"]);
  assert.equal(h.created[0].businessName, "Glow Home Services");
  assert.equal(h.created[0].createdBy, "joseph");
  assert.deepEqual(h.created[0].challenges, ["Misses after-hours calls"]);
  const scope = h.saved[0].sections.find((s) => s.key === "scope")!;
  assert.equal(scope.body, "We will set up after-hours booking.");
  const inv = h.saved[0].sections.find((s) => s.key === "investment")!;
  assert.equal(inv.body, "The total investment is $0.");
});

test("pipeline: unknown lead and no transcribed calls are refused before any brief", async () => {
  const h = harness();
  assert.deepEqual(await runCallProposal("nope", "j", h.deps), { ok: false, reason: "not_found" });
  const h2 = harness({ loadCalls: async () => [{ ...calls[1], transcript: "  " }] });
  assert.deepEqual(await runCallProposal("lead-1", "j", h2.deps), { ok: false, reason: "no_calls" });
  assert.equal(h2.briefs.size, 0);
});

test("pipeline: a second run while one is active is refused", async () => {
  const h = harness();
  await h.deps.insertBrief({ leadId: "lead-1", createdBy: "j", promptVersion: "v" });
  assert.deepEqual(await runCallProposal("lead-1", "j", h.deps), { ok: false, reason: "in_progress" });
});

// Failures are logged for operators; keep test output clean.
mock.method(console, "error", () => {});

test("pipeline: stale runs are failed before inserting", async () => {
  const seen: [string, number][] = [];
  const h = harness({ failStaleRuns: async (id, ms) => void seen.push([id, ms]) });
  await runCallProposal("lead-1", "j", h.deps);
  assert.deepEqual(seen, [["lead-1", 360_000]]);
});

test("pipeline: extract failure records stage and creates no proposal", async () => {
  const h = harness({}, { extract: () => { throw new Error("upstream 529"); } });
  const r = await runCallProposal("lead-1", "j", h.deps);
  assert.equal(r.ok, false);
  assert.equal(h.briefs.get("b1")!.status, "failed");
  assert.equal(h.briefs.get("b1")!.failedStage, "extract");
  assert.equal(h.briefs.get("b1")!.error, "Something went wrong while drafting. Try again.");
  assert.doesNotMatch(h.briefs.get("b1")!.error, /upstream 529/);
  assert.equal(h.created.length, 0);
});

test("pipeline: invalid extract output fails with a readable error", async () => {
  const h = harness({}, { extract: { nope: true } });
  const r = await runCallProposal("lead-1", "j", h.deps);
  assert.equal(r.ok === false && r.reason === "failed" && r.stage, "extract");
  assert.match(h.briefs.get("b1")!.error, /^Claude returned an unexpected answer\. Invalid model output/);
});

test("pipeline: a refusal reads as a plain sentence", async () => {
  const refusal = Object.assign(new Error("declined"), { name: "AiError", code: "refused" });
  const h = harness({}, { draft: () => { throw refusal; } });
  await runCallProposal("lead-1", "j", h.deps);
  assert.match(h.briefs.get("b1")!.error, /Claude declined/);
});

test("pipeline: provider errors map to plain copy and never leak raw text", async () => {
  const cases: [string, RegExp][] = [
    ["rate_limited", /rate-limited/],
    ["paused", /paused/],
    ["upstream", /couldn't complete this step/],
  ];
  for (const [code, re] of cases) {
    const err = Object.assign(new Error("raw sdk 529 detail"), { name: "AiError", code });
    const h = harness({}, { extract: () => { throw err; } });
    await runCallProposal("lead-1", "j", h.deps);
    assert.match(h.briefs.get("b1")!.error, re);
    assert.doesNotMatch(h.briefs.get("b1")!.error, /raw sdk/);
  }
});

test("pipeline: draft failure keeps the extraction; retry drafts from it", async () => {
  let fail = true;
  const h = harness({}, { draft: () => { if (fail) throw new Error("timeout"); return draftOut; } });
  const first = await runCallProposal("lead-1", "j", h.deps);
  assert.equal(first.ok, false);
  const b = h.briefs.get("b1")!;
  assert.equal(b.failedStage, "draft");
  assert.ok(b.extraction);
  fail = false;
  const second = await retryDraft("b1", h.deps);
  assert.deepEqual(second, { ok: true, briefId: "b1", proposalId: "p1" });
  assert.equal(h.briefs.get("b1")!.status, "ready");
  assert.equal(h.briefs.get("b1")!.failedStage, null);
  assert.equal(h.briefs.get("b1")!.inputTokens, 20);
  assert.deepEqual(h.briefs.get("b1")!.warnings.map((w) => w.code), ["unverified_quotes"]);
});

test("pipeline: retry refuses a ready brief or an extract failure", async () => {
  const h = harness();
  await runCallProposal("lead-1", "j", h.deps);
  assert.deepEqual(await retryDraft("b1", h.deps), { ok: false, reason: "not_retryable" });
  assert.deepEqual(await retryDraft("missing", h.deps), { ok: false, reason: "not_found" });
  const h2 = harness({}, { extract: () => { throw new Error("x"); } });
  await runCallProposal("lead-1", "j", h2.deps);
  assert.deepEqual(await retryDraft("b1", h2.deps), { ok: false, reason: "not_retryable" });
});

test("pipeline: a price in a tailored section adds a currency warning", async () => {
  const withPrice = {
    ...draftOut,
    sections: [{ key: "scope", body: "Fits your $5,000 budget." }],
  };
  const h = harness({}, { draft: withPrice });
  await runCallProposal("lead-1", "j", h.deps);
  const codes = h.briefs.get("b1")!.warnings.map((w) => w.code);
  assert.deepEqual(codes, ["unverified_quotes", "currency_in_draft"]);
  assert.match(h.briefs.get("b1")!.warnings[1].detail, /Scope/);
});

test("pipeline: unknown template key from the model falls back", async () => {
  const h = harness({}, { extract: { ...extractOut, suggested_template_key: "made_up" } });
  await runCallProposal("lead-1", "j", h.deps);
  assert.equal(h.created[0].templateKey, "business_systems");
});

test("pipeline: result status mapping", () => {
  assert.deepEqual(runResultStatus({ ok: true, briefId: "b", proposalId: "p" }), { status: 200, error: null });
  assert.equal(runResultStatus({ ok: false, reason: "no_calls" }).status, 400);
  assert.equal(runResultStatus({ ok: false, reason: "not_found" }).status, 404);
  assert.equal(runResultStatus({ ok: false, reason: "in_progress" }).status, 409);
  assert.equal(runResultStatus({ ok: false, reason: "not_retryable" }).status, 409);
  assert.deepEqual(
    runResultStatus({ ok: false, reason: "failed", briefId: "b", stage: "draft", error: "boom" }),
    { status: 502, error: "boom" },
  );
});

test("pipeline: retry after a late save failure reuses the existing proposal", async () => {
  let failSave = true;
  const h = harness({
    saveProposalSections: async (id, sections) => {
      if (failSave) throw new Error("db down");
      h.saved.push({ id, sections });
    },
  });
  const first = await runCallProposal("lead-1", "j", h.deps);
  assert.equal(first.ok, false);
  assert.equal(h.briefs.get("b1")!.failedStage, "draft");
  assert.equal(h.briefs.get("b1")!.proposalId, "p1");
  failSave = false;
  const second = await retryDraft("b1", h.deps);
  assert.deepEqual(second, { ok: true, briefId: "b1", proposalId: "p1" });
  assert.equal(h.created.length, 1);
  assert.equal(h.briefs.get("b1")!.proposalId, "p1");
  assert.equal(h.saved.length, 1);
  assert.equal(h.saved[0].id, "p1");
});

test("pipeline: retry creates a new proposal if the first one was deleted", async () => {
  let failSave = true;
  const h = harness({
    saveProposalSections: async (id, sections) => {
      if (failSave) throw new Error("db down");
      h.saved.push({ id, sections });
    },
    loadProposalSections: async () => null,
  });
  await runCallProposal("lead-1", "j", h.deps);
  failSave = false;
  const second = await retryDraft("b1", h.deps);
  assert.deepEqual(second, { ok: true, briefId: "b1", proposalId: "p2" });
  assert.equal(h.created.length, 2);
  assert.equal(h.briefs.get("b1")!.proposalId, "p2");
  assert.equal(h.saved[0].id, "p2");
});

test("pipeline: a crash building the transcript block fails the brief at extract", async () => {
  const bad = { ...calls[1] };
  Object.defineProperty(bad, "segments", {
    get() {
      throw new Error("segments exploded");
    },
  });
  const h = harness({ loadCalls: async () => [bad] });
  const r = await runCallProposal("lead-1", "j", h.deps);
  assert.equal(r.ok === false && r.reason === "failed" && r.stage, "extract");
  assert.equal(h.briefs.get("b1")!.status, "failed");
  assert.equal(h.briefs.get("b1")!.failedStage, "extract");
});
