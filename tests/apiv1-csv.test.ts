import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "../lib/apiv1/csv.ts";

describe("toCsv", () => {
  it("quotes, escapes, guards formulas and serialises objects", () => {
    const csv = toCsv(
      [
        { name: 'Acme, "Inc"', email: "a@b.c", score: 42, meta: { x: 1 }, none: null, f: "=SUM(A1)" },
      ],
      [
        { key: "name", header: "Name" }, { key: "email", header: "Email" }, { key: "score", header: "Score" },
        { key: "meta", header: "Meta" }, { key: "none", header: "None" }, { key: "f", header: "Formula" },
      ],
    );
    assert.equal(
      csv,
      'Name,Email,Score,Meta,None,Formula\r\n"Acme, ""Inc""",a@b.c,42,"{""x"":1}",,\'=SUM(A1)\r\n',
    );
  });
  it("handles zero rows", () => {
    assert.equal(toCsv([], [{ key: "a", header: "A" }]), "A\r\n");
  });
});
