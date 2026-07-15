import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateTotpSecret, verifyTotp } from "../lib/totp.ts";
import { createHmac } from "node:crypto";

function hotp(secretB32: string, counter: number): string {
  // Mirror lib/totp for a known-good code without exporting hotp
  const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = secretB32.replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (const c of cleaned) {
    const val = BASE32.indexOf(c);
    if (val >= 0) bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  const key = Buffer.from(bytes);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

describe("totp", () => {
  it("generates a base32 secret and verifies the current code", () => {
    const secret = generateTotpSecret();
    assert.match(secret, /^[A-Z2-7]+$/);
    const counter = Math.floor(Date.now() / 1000 / 30);
    const code = hotp(secret, counter);
    assert.equal(verifyTotp(secret, code), true);
  });

  it("rejects wrong codes", () => {
    const secret = generateTotpSecret();
    assert.equal(verifyTotp(secret, "000000"), false);
    assert.equal(verifyTotp(secret, "abcdef"), false);
  });
});
