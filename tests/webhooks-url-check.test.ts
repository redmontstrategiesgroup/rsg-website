import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkWebhookUrl, isBlockedHost } from "../lib/webhooks/url-check.ts";

const prod = { allowHttp: false };
describe("checkWebhookUrl", () => {
  it("accepts a normal https url", () => {
    assert.deepEqual(checkWebhookUrl("https://hooks.example.com/rsg?x=1", prod), {
      ok: true,
      url: "https://hooks.example.com/rsg?x=1",
    });
  });
  it("rejects http in prod, allows it in dev", () => {
    assert.equal(checkWebhookUrl("http://hooks.example.com/", prod).ok, false);
    assert.equal(checkWebhookUrl("http://hooks.example.com/", { allowHttp: true }).ok, true);
  });
  it("rejects private, loopback, link-local, cgnat, metadata and local names", () => {
    for (const u of [
      "https://localhost/x", "https://foo.localhost/x", "https://db.internal/x", "https://printer.local/x",
      "https://127.0.0.1/x", "https://10.1.2.3/x", "https://172.16.0.9/x", "https://172.31.255.255/x", "https://192.168.1.1/x",
      "https://169.254.169.254/latest", "https://100.64.0.1/x", "https://0.0.0.0/x",
      "https://[::1]/x", "https://[fc00::1]/x", "https://[fe80::1]/x", "https://[::ffff:10.0.0.1]/x",
    ]) assert.equal(checkWebhookUrl(u, prod).ok, false, u);
    assert.equal(checkWebhookUrl("https://172.32.0.1/x", prod).ok, true);
    assert.equal(checkWebhookUrl("https://8.8.8.8/x", prod).ok, true);
  });
  it("rejects garbage, credentials, other schemes and huge urls", () => {
    assert.deepEqual(checkWebhookUrl("not a url", prod), { ok: false, reason: "invalid" });
    assert.equal(checkWebhookUrl("https://u:p@hooks.example.com/", prod).ok, false);
    assert.equal(checkWebhookUrl("ftp://hooks.example.com/", prod).ok, false);
    assert.deepEqual(checkWebhookUrl("https://x.com/" + "a".repeat(2100), prod), { ok: false, reason: "length" });
  });
  it("isBlockedHost", () => {
    assert.equal(isBlockedHost("api.stripe.com"), false);
    assert.equal(isBlockedHost("LOCALHOST"), true);
  });
  it("allowPrivate lifts only the host block", () => {
    const dev = { allowHttp: true, allowPrivate: true };
    assert.equal(checkWebhookUrl("http://127.0.0.1:3999/ok", dev).ok, true);
    assert.equal(checkWebhookUrl("http://u:p@127.0.0.1:3999/ok", dev).ok, false);
    assert.equal(checkWebhookUrl("ftp://127.0.0.1/", dev).ok, false);
  });
});
