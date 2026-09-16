import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adjacentSection, swipeDirection } from "../components/demos/sectionNav.ts";

const ids = ["overview", "leads", "pipeline"] as const;

describe("adjacentSection", () => {
  it("moves forward and back within the list", () => {
    assert.equal(adjacentSection(ids, "overview", 1), "leads");
    assert.equal(adjacentSection(ids, "pipeline", -1), "leads");
  });
  it("returns null at either end (no wrap)", () => {
    assert.equal(adjacentSection(ids, "pipeline", 1), null);
    assert.equal(adjacentSection(ids, "overview", -1), null);
  });
  it("returns null when the current id is unknown", () => {
    assert.equal(adjacentSection(ids, "settings", 1), null);
  });
});

describe("swipeDirection", () => {
  it("treats a long, mostly horizontal drag as a swipe", () => {
    // Swipe left (finger moves right-to-left) reveals the NEXT section.
    assert.equal(swipeDirection(-80, 10), 1);
    assert.equal(swipeDirection(80, -10), -1);
  });
  it("ignores short drags", () => {
    assert.equal(swipeDirection(-30, 0), 0);
  });
  it("ignores drags that are more vertical than horizontal so lists still scroll", () => {
    assert.equal(swipeDirection(-80, 90), 0);
    assert.equal(swipeDirection(-80, 60), 0);
  });
});
