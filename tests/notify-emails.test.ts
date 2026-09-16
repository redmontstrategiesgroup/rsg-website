import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CONTACT_NOTIFY_EMAILS,
  DEFAULT_CONTACT_TO_EMAIL,
  DEFAULT_OWNER_NOTIFY_EMAIL,
  contactNotifyEmails,
  parseEmailList,
  primaryContactEmail,
} from "../lib/notify-emails.ts";

/** Restore CONTACT_TO_EMAIL so tests can't leak into each other. */
function withEnv(value: string | undefined, fn: () => void): void {
  const previous = process.env.CONTACT_TO_EMAIL;
  if (value === undefined) delete process.env.CONTACT_TO_EMAIL;
  else process.env.CONTACT_TO_EMAIL = value;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.CONTACT_TO_EMAIL;
    else process.env.CONTACT_TO_EMAIL = previous;
  }
}

test("the owner's inbox is a default recipient, not an opt-in", () => {
  assert.equal(DEFAULT_CONTACT_TO_EMAIL, "contact@redmontstrategiesgroup.com");
  assert.equal(
    DEFAULT_OWNER_NOTIFY_EMAIL,
    "josephoday@redmontstrategiesgroup.com"
  );
  withEnv(undefined, () => {
    assert.deepEqual(contactNotifyEmails(), [...DEFAULT_CONTACT_NOTIFY_EMAILS]);
    assert.equal(contactNotifyEmails().length, 2);
  });
});

test("an unset or blank CONTACT_TO_EMAIL still notifies both defaults", () => {
  withEnv("", () => {
    assert.deepEqual(contactNotifyEmails(), [...DEFAULT_CONTACT_NOTIFY_EMAILS]);
  });
  withEnv("   ", () => {
    assert.deepEqual(contactNotifyEmails(), [...DEFAULT_CONTACT_NOTIFY_EMAILS]);
  });
});

test("CONTACT_TO_EMAIL replaces the defaults and accepts a list", () => {
  withEnv("a@example.com, b@example.com", () => {
    assert.deepEqual(contactNotifyEmails(), ["a@example.com", "b@example.com"]);
    assert.equal(primaryContactEmail(), "a@example.com");
  });
});

test("parseEmailList dedupes case-insensitively so nobody is mailed twice", () => {
  assert.deepEqual(
    parseEmailList("Owner@Example.com, owner@example.com,team@example.com"),
    ["Owner@Example.com", "team@example.com"]
  );
});

test("parseEmailList tolerates the separators an operator actually types", () => {
  assert.deepEqual(parseEmailList("a@x.com;b@x.com\nc@x.com  d@x.com"), [
    "a@x.com",
    "b@x.com",
    "c@x.com",
    "d@x.com",
  ]);
});

test("parseEmailList drops entries that are not addresses", () => {
  assert.deepEqual(parseEmailList("not-an-email, , @nolocal.com, ok@x.com"), [
    "ok@x.com",
  ]);
  assert.deepEqual(parseEmailList(undefined), []);
  assert.deepEqual(parseEmailList(null), []);
});

test("primaryContactEmail falls back when the list resolves to nothing", () => {
  withEnv("garbage", () => {
    // "garbage" has no @, so the list falls back to the defaults.
    assert.equal(primaryContactEmail(), DEFAULT_CONTACT_TO_EMAIL);
  });
});
