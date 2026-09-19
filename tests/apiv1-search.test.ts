import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { orIlike, searchTerm } from "../lib/apiv1/search.ts";

describe("searchTerm", () => {
  it("trims, escapes like wildcards and strips PostgREST syntax chars", () => {
    assert.equal(searchTerm("  ac%me_ (x),y  "), "ac\\%me\\_ xy");
    assert.equal(searchTerm(""), null);
    assert.equal(searchTerm(undefined), null);
    assert.equal(searchTerm("   "), null);
    assert.equal(searchTerm("a bc"), "a bc");
    assert.equal(searchTerm("x".repeat(100))!.length, 80);
  });
});

describe("orIlike", () => {
  it("builds the PostgREST or() filter", () => {
    assert.equal(orIlike(["name", "email"], "acme"), "name.ilike.%acme%,email.ilike.%acme%");
  });
});
