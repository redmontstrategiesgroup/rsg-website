import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_SECRET ??= "test-secret-with-enough-length-0123456789";
process.env.NEXT_PUBLIC_SITE_URL ??= "https://example.test";

const mod = () => import("../lib/unsubscribe.ts");

describe("unsubscribe tokens", () => {
  let u: Awaited<ReturnType<typeof mod>>;
  before(async () => {
    u = await mod();
  });

  it("round-trips a signed link", () => {
    const url = new URL(u.unsubscribeUrl("Person@Example.com"));
    const email = u.decodeEmailParam(url.searchParams.get("e"));
    assert.equal(email, "person@example.com");
    assert.equal(u.verifyUnsubscribeToken(email!, url.searchParams.get("t")!), true);
  });

  it("is case-insensitive on the address", () => {
    const t = u.createUnsubscribeToken("a@b.co");
    assert.equal(u.verifyUnsubscribeToken("A@B.CO", t), true);
  });

  it("rejects a tampered token or a swapped address", () => {
    const t = u.createUnsubscribeToken("a@b.co");
    assert.equal(u.verifyUnsubscribeToken("a@b.co", t.slice(0, -1) + "x"), false);
    assert.equal(u.verifyUnsubscribeToken("other@b.co", t), false);
    assert.equal(u.verifyUnsubscribeToken("a@b.co", ""), false);
  });

  it("rejects a malformed address parameter", () => {
    assert.equal(u.decodeEmailParam(null), null);
    assert.equal(u.decodeEmailParam(Buffer.from("not-an-email").toString("base64url")), null);
  });

  it("emits List-Unsubscribe headers with one-click support", () => {
    const h = u.unsubscribeHeaders("a@b.co");
    assert.match(h["List-Unsubscribe"], /^<https:\/\/example\.test\/api\/unsubscribe\?e=.+&t=.+>$/);
    assert.equal(h["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  });
});
