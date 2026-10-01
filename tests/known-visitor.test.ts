import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  KNOWN_PARAM,
  isKnownVisitorPath,
  withKnownMarker,
} from "../lib/known-visitor.ts";

describe("known visitor", () => {
  it("recognises private-link pages we email", () => {
    for (const p of [
      "/booking/manage/abc123",
      "/booking/confirmed",
      "/assessment/tok",
      "/prepare/tok",
      "/proposal/tok",
      "/proposals/tok",
      "/agreement/tok",
      "/pay/tok",
      "/portal",
      "/portal/support",
      "/portal/invite/tok",
    ]) {
      assert.equal(isKnownVisitorPath(p), true, p);
    }
  });

  it("leaves public pages alone", () => {
    for (const p of [
      "/",
      "/book",
      "/book/strategy",
      "/booking/review",
      "/booking/noteligible",
      "/assessment",
      "/payments",
      "/portalx",
      "/services",
    ]) {
      assert.equal(isKnownVisitorPath(p), false, p);
    }
  });

  it("tags email links, keeping existing params", () => {
    assert.equal(
      withKnownMarker("https://example.test/book"),
      `https://example.test/book?${KNOWN_PARAM}=1`,
    );
    assert.equal(
      withKnownMarker("https://example.test/book/strategy?utm_source=x"),
      `https://example.test/book/strategy?utm_source=x&${KNOWN_PARAM}=1`,
    );
  });
});
