import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

const seen: string[] = [];
mock.module("@/lib/leads", { namedExports: { processLead: async (l: { email: string }) => { seen.push(l.email); return { duplicate: l.email === "dup@x.y", leadId: "SECRET", storedInDatabase: true, storedLocally: true, storedRemotely: true, emailed: true }; } } });
const { submitLead } = await import("../lib/apiv1/resources/public-leads.ts");
const args = (body: unknown) => ({ principal: null, body, query: {}, params: {}, request: new Request("http://x/api/v1/public/leads"), correlationId: "c" }) as never;
const body = { name: "Ann", email: "a@x.y", company: "", phone: "", message: "hi", source: "api_public" };

describe("public lead submit", () => {
  it("honeypot filled → 202 without processing", async () => {
    const r = await submitLead(args({ ...body, website_url: "http://spam" }));
    assert.equal(r.status, 202); assert.deepEqual(r.data, { accepted: true }); assert.equal(seen.length, 0);
  });
  it("normal → 202 accepted, duplicate flag, no id", async () => {
    const r = await submitLead(args(body)); assert.deepEqual(r.data, { accepted: true, duplicate: false });
    const d = await submitLead(args({ ...body, email: "dup@x.y" })); assert.deepEqual(d.data, { accepted: true, duplicate: true });
    assert.equal(JSON.stringify(d.data).includes("SECRET"), false);
  });
});
