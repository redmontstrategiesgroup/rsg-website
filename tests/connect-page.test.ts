import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultConnectLinks,
  filterAndOrderLinks,
  isLinkLive,
} from "../lib/connect-defaults.ts";

test("filterAndOrderLinks hides inactive and expired links", () => {
  const links = defaultConnectLinks().map((l, i) =>
    i === 0
      ? { ...l, active: false }
      : i === 1
        ? { ...l, expiresAt: "2000-01-01T00:00:00.000Z" }
        : l
  );
  const live = filterAndOrderLinks(links);
  assert.equal(live.some((l) => l.id === "link-book"), false);
  assert.equal(live.some((l) => l.id === "link-services"), false);
  assert.ok(live.some((l) => l.id === "link-demos"));
});

test("instagram source prioritizes demos", () => {
  const ordered = filterAndOrderLinks(defaultConnectLinks(), "instagram");
  assert.equal(ordered[0]?.id, "link-demos");
  assert.ok(isLinkLive(ordered[0]!));
});

test("default connect links include booking and portal", () => {
  const ids = defaultConnectLinks().map((l) => l.id);
  assert.ok(ids.includes("link-book"));
  assert.ok(ids.includes("link-portal"));
  assert.equal(ids.includes("link-audit"), false);
  assert.equal(ids.includes("link-ai"), false);
});

test("default settings include Instagram and Facebook", async () => {
  const { defaultConnectSettings } = await import("../lib/connect-defaults.ts");
  const s = defaultConnectSettings();
  assert.match(s.socialInstagram, /instagram\.com\/redmontstrategiesgroup/);
  assert.match(s.socialFacebook, /facebook\.com\/redmontstrategiesgroup/);
});
