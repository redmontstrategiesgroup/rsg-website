import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSectionsInput,
  refreshPricePhrases,
  refreshPriceSections,
  validatePrice,
} from "../lib/lifecycle/proposal-edit.ts";

test("reprice: investment and payment_schedule text is replaced, everything else kept", () => {
  const current = [
    { key: "scope", title: "Scope", body: "edited by Joseph" },
    { key: "investment", title: "Your Investment", body: "The total investment is $0.", hidden: false },
    { key: "payment_schedule", title: "Payments", body: "Split of $0.", items: [{ title: "old" }] },
  ];
  const fresh = [
    { key: "scope", title: "Scope", body: "template scope" },
    { key: "investment", title: "Investment", body: "The total investment is $9,000." },
    { key: "payment_schedule", title: "Payment Schedule", body: "Split of $9,000." },
  ];
  const out = refreshPriceSections(current, fresh);
  assert.equal(out[0].body, "edited by Joseph");
  assert.equal(out[1].body, "The total investment is $9,000.");
  assert.equal(out[1].title, "Your Investment");
  assert.equal(out[2].body, "Split of $9,000.");
  assert.equal(out[2].items, undefined);
});

test("reprice: price validation", () => {
  assert.equal(validatePrice(900000, 300000), null);
  assert.equal(validatePrice(0, 0), null);
  assert.match(validatePrice(100, 200)!, /deposit can't be more/);
  assert.match(validatePrice(-1, 0)!, /Total/);
  assert.match(validatePrice(Number.NaN, 0)!, /Total/);
  assert.match(validatePrice(100, 1.5)!, /Deposit/);
});

test("sections input: valid sections pass and are trimmed", () => {
  const r = parseSectionsInput([{ key: "scope", title: " Scope ", body: "b", items: [{ title: "i" }], hidden: false }]);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.sections[0].title, "Scope");
});

test("sections input: wrong shapes and oversize input are rejected", () => {
  assert.equal(parseSectionsInput("nope").ok, false);
  assert.equal(parseSectionsInput([{ key: "scope" }]).ok, false);
  assert.equal(parseSectionsInput(Array.from({ length: 41 }, () => ({ key: "k", title: "t", body: "" }))).ok, false);
  assert.equal(parseSectionsInput([{ key: "s", title: "t", body: "x".repeat(20_001) }]).ok, false);
});

test("price phrases: summary and next-steps sentences follow the new price", () => {
  const out = refreshPricePhrases(
    [
      { key: "executive_summary", title: "Summary", body: "The total investment is $0, paid against milestones and beginning with a $0 deposit." },
      { key: "next_steps", title: "Next", body: "", items: [{ title: "Sign", detail: "The $0 deposit reserves your build slot." }] },
      { key: "scope", title: "Scope", body: "a $500 ad budget" },
    ],
    900000,
    300000,
  );
  assert.equal(out[0].body, "The total investment is $9,000, paid against milestones and beginning with a $3,000 deposit.");
  assert.equal(out[1].items![0].detail, "The $3,000 deposit reserves your build slot.");
  assert.equal(out[2].body, "a $500 ad budget");
});
