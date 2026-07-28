/**
 * Simplified booking intake validation (pure module, no I/O).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  intakeContactSchema,
  intakeAnswersSchema,
  splitFullName,
} from "../lib/scheduling/intake-schema.ts";

describe("splitFullName", () => {
  it("splits a simple first/last name", () => {
    assert.deepEqual(splitFullName("Jordan Lee"), {
      firstName: "Jordan",
      lastName: "Lee",
    });
  });

  it("keeps multi-part last names together", () => {
    assert.deepEqual(splitFullName("Mary Anne van der Berg"), {
      firstName: "Mary",
      lastName: "Anne van der Berg",
    });
  });

  it("handles a single name and stray whitespace", () => {
    assert.deepEqual(splitFullName("  Cher  "), {
      firstName: "Cher",
      lastName: "",
    });
  });
});

describe("intakeContactSchema", () => {
  const valid = {
    fullName: "Jordan Lee",
    businessName: "South Shore Clinic",
    email: "jordan@example.com",
    phone: "(781) 555-0100",
    industry: "Dental",
    website: "example.com",
    preferredContact: "phone" as const,
  };

  it("accepts a complete valid contact", () => {
    const parsed = intakeContactSchema.parse(valid);
    assert.equal(parsed.fullName, "Jordan Lee");
    assert.equal(parsed.preferredContact, "phone");
  });

  it("defaults optional fields and preferred contact", () => {
    const parsed = intakeContactSchema.parse({
      fullName: "Jordan Lee",
      businessName: "South Shore Clinic",
      email: "jordan@example.com",
      phone: "7815550100",
    });
    assert.equal(parsed.industry, "");
    assert.equal(parsed.website, "");
    assert.equal(parsed.preferredContact, "email");
  });

  it("rejects a phone number with fewer than 10 digits", () => {
    assert.throws(() =>
      intakeContactSchema.parse({ ...valid, phone: "555-0100" })
    );
  });

  it("rejects an invalid email", () => {
    assert.throws(() =>
      intakeContactSchema.parse({ ...valid, email: "not-an-email" })
    );
  });

  it("strips control characters from text fields", () => {
    const parsed = intakeContactSchema.parse({
      ...valid,
      businessName: "South\u0000 Shore\u001f Clinic",
    });
    assert.equal(parsed.businessName, "South Shore Clinic");
  });
});

describe("intakeAnswersSchema", () => {
  it("accepts an empty object (all questions optional)", () => {
    const parsed = intakeAnswersSchema.parse({});
    assert.deepEqual(parsed, {});
  });

  it("defaults when answers are missing entirely", () => {
    const parsed = intakeAnswersSchema.parse(undefined);
    assert.deepEqual(parsed, {});
  });

  it("accepts optional detail answers", () => {
    const parsed = intakeAnswersSchema.parse({
      problem: "We lose leads after the first call.",
      result: "Get more qualified leads",
      business_size: "6 – 20",
      interested_services: ["Get more leads or customers"],
      current_tools: "QuickBooks, Google Sheets",
    });
    assert.equal(parsed.result, "Get more qualified leads");
    assert.deepEqual(parsed.interested_services, [
      "Get more leads or customers",
    ]);
  });

  it("rejects oversized answer lists", () => {
    assert.throws(() =>
      intakeAnswersSchema.parse({
        interested_services: Array.from({ length: 13 }, (_, i) => `s${i}`),
      })
    );
  });
});
