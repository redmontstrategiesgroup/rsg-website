/**
 * Interactive-demo "Request this system" validation (pure module, no I/O).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_REQUEST_SLUGS,
  demoRequestSchema,
} from "../lib/demo-request-schema.ts";

const valid = {
  name: "Jordan Ellis",
  company: "South Shore Roofing Co",
  email: "jordan@example.com",
  phone: "(781) 555-0100",
  preferredContact: "phone" as const,
  businessSize: "2 – 5 people",
  preferredDate: "2026-07-20",
  preferredTime: "Morning (8–12)",
  notes: "We miss a lot of calls during storms.",
  services: ["AI receptionist & missed-call recovery"],
  demoSlug: "contractors" as const,
  featuresExplored: ["moved pipeline records", "completed the AI receptionist conversation"],
  scenariosRun: 2,
  pageUrl: "https://example.com/demos/contractors",
  hp: "",
};

describe("demoRequestSchema", () => {
  it("accepts a complete valid request", () => {
    const parsed = demoRequestSchema.parse(valid);
    assert.equal(parsed.name, "Jordan Ellis");
    assert.equal(parsed.demoSlug, "contractors");
    assert.equal(parsed.services.length, 1);
    assert.equal(parsed.featuresExplored.length, 2);
  });

  it("accepts a minimal request (optional fields omitted)", () => {
    const parsed = demoRequestSchema.parse({
      name: "Sam Lee",
      company: "Lee Dental",
      email: "sam@example.com",
      phone: "7815550123",
      demoSlug: "dental",
    });
    assert.equal(parsed.preferredContact, "email");
    assert.deepEqual(parsed.services, []);
    assert.deepEqual(parsed.featuresExplored, []);
  });

  it("rejects an unknown demo slug", () => {
    assert.throws(() =>
      demoRequestSchema.parse({ ...valid, demoSlug: "unknown-industry" })
    );
  });

  it("rejects a short phone number", () => {
    assert.throws(() => demoRequestSchema.parse({ ...valid, phone: "555" }));
  });

  it("rejects an invalid email", () => {
    assert.throws(() => demoRequestSchema.parse({ ...valid, email: "not-an-email" }));
  });

  it("rejects a missing company", () => {
    assert.throws(() => demoRequestSchema.parse({ ...valid, company: "  " }));
  });

  it("strips control characters from free text", () => {
    const parsed = demoRequestSchema.parse({
      ...valid,
      notes: `line one${String.fromCharCode(0)}${String.fromCharCode(27)} line two`,
    });
    assert.equal(parsed.notes, "line one line two");
  });

  it("caps the explored-features list at 40 entries", () => {
    assert.throws(() =>
      demoRequestSchema.parse({
        ...valid,
        featuresExplored: Array.from({ length: 41 }, (_, i) => `feature ${i}`),
      })
    );
  });

  it("keeps the honeypot value for the route to inspect", () => {
    const parsed = demoRequestSchema.parse({ ...valid, hp: "bot text" });
    assert.equal(parsed.hp, "bot text");
  });

  it("covers every live demo slug", () => {
    assert.deepEqual([...DEMO_REQUEST_SLUGS].sort(), [
      "contractors",
      "dental",
      "gyms",
      "medspa",
      "retail",
    ]);
  });
});
