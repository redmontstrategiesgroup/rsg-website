import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clampViewportHeight } from "../lib/mobile.ts";

describe("clampViewportHeight", () => {
  it("keeps the chat panel within a safe mobile range", () => {
    assert.equal(clampViewportHeight(800), 620);
    assert.equal(clampViewportHeight(400), 400);
    assert.equal(clampViewportHeight(200), 320);
  });
});
