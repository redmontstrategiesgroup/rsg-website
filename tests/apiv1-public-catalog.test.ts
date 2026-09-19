import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

mock.module("@/lib/scheduling/catalog", { namedExports: {
  listActiveServices: async () => [{ id: "s", name: "Consult", slug: "consult", description: "d", sort_order: 1, active: true, LEAK: 1 }],
  listPublicAppointmentTypes: async () => [{ id: "a", name: "Intro", slug: "intro", public_description: "pd", service_id: "s", duration_minutes: 30, meeting_formats: ["phone"], price_cents: null, LEAK: 1 }],
} });
mock.module("@/lib/industries/store", { namedExports: { getVerticals: async () => [{ slug: "contractors", name: "Contractors", shortName: "Trades", status: "published", hero: { LEAK: 1 } }, { slug: "x", name: "X", shortName: "X", status: "draft" }] } });
mock.module("@/lib/managed-services/store", { namedExports: { listPlans: async () => [{ id: "p", key: "core", name: "Core", tagline: "t", monthlyPriceCents: 100, annualPriceCents: null, setupFeeCents: 0, customPricing: false, includedHours: 5, supportLevel: "s", responseTime: "r", minimumCommitmentMonths: 3, features: ["f"], recommended: true, detailedScope: ["LEAK"], addons: [], comparison: {} }] } });
let pingThrows = false;
mock.module("@/lib/supabase", { namedExports: { isSupabaseConfigured: () => true, getSupabase: () => ({ from: () => ({ select: async () => { if (pingThrows) throw new Error("down"); return { count: 0, error: null }; } }) }) } });

const { listServices, listIndustries, listPlansHandler } = await import("../lib/apiv1/resources/public-catalog.ts");
const { getStatus } = await import("../lib/apiv1/resources/public-status.ts");
const args = () => ({ principal: null, body: undefined, query: {}, params: {}, request: new Request("http://x/api/v1/public/x"), correlationId: "c" }) as never;

describe("public catalog", () => {
  it("services + appointment types, no leaks", async () => {
    const r = await listServices(args());
    assert.equal(JSON.stringify(r.data).includes("LEAK"), false);
    assert.deepEqual(Object.keys((r.data as { appointment_types: object[] }).appointment_types[0]!).sort(), ["description", "duration_minutes", "id", "meeting_formats", "name", "price_cents", "service_id", "slug"]);
  });
  it("only published industries; plan DTO shape", async () => {
    assert.deepEqual(((await listIndustries(args())).data as { slug: string }[]).map((v) => v.slug), ["contractors"]);
    const plans = (await listPlansHandler(args())).data as Record<string, unknown>[];
    assert.equal("detailedScope" in plans[0]!, false); assert.equal(plans[0]!.monthly_price_cents, 100);
  });
  it("status ok / degraded; version resolves from package.json, not npm_package_version", async () => {
    const ok = await getStatus(args());
    assert.equal((ok.data as { status: string }).status, "ok");
    assert.notEqual((ok.data as { version: string }).version, "unknown");
    pingThrows = true;
    const r = await getStatus(args());
    assert.equal(r.status, 503); assert.equal((r.data as { checks: { database: string } }).checks.database, "unreachable");
  });
});
