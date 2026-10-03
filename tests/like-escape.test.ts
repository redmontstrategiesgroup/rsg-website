import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { escapeLikePattern, isEmail } from "../lib/validate.ts";

/**
 * Regression guard for LIKE-wildcard injection in email lookups.
 *
 * `isEmail` accepts `%`, `_` and `*` (none are whitespace or `@`), so an
 * address like `%@%.com` passes validation. Passed unescaped to
 * `.ilike("email", value)` it stops being a lookup for one account and
 * becomes a pattern matching an arbitrary row: the portal login, the team
 * invite check and the lead-dedupe path all did exactly that.
 */
describe("escapeLikePattern", () => {
  it("escapes the SQL LIKE wildcards", () => {
    assert.equal(escapeLikePattern("%@%.com"), String.raw`\%@\%.com`);
    assert.equal(escapeLikePattern("a_b@x.com"), String.raw`a\_b@x.com`);
  });

  it("escapes `*`, which PostgREST rewrites to `%` before Postgres sees it", () => {
    assert.equal(escapeLikePattern("a*b@x.com"), String.raw`a\*b@x.com`);
  });

  it("escapes the escape character itself", () => {
    // A raw template literal cannot end in a lone backslash, hence the charCode.
    const backslash = String.fromCharCode(92);
    assert.equal(escapeLikePattern(backslash), backslash + backslash);
  });

  it("leaves an ordinary address untouched", () => {
    const plain = "owner@example.com";
    assert.equal(escapeLikePattern(plain), plain);
  });

  it("neutralises the wildcard addresses that isEmail lets through", () => {
    for (const attack of ["%@%.com", "%@example.com", "a*@%.com", "_@_._"]) {
      assert.ok(isEmail(attack), `${attack} should pass isEmail`);
      const escaped = escapeLikePattern(attack);
      // Every %, _ and * must be backslash-prefixed: none acts as a wildcard.
      for (let i = 0; i < escaped.length; i++) {
        if ("%_*".includes(escaped[i])) {
          assert.equal(escaped[i - 1], String.fromCharCode(92), `unescaped ${escaped[i]} in ${escaped}`);
        }
      }
    }
  });
});
