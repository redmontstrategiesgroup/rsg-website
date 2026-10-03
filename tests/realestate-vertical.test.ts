/**
 * Real estate vertical content integrity (pure modules, no I/O).
 *
 * Every import here is a module whose only relative imports are type-only, so
 * node:test can load them without a bundler. Keep it that way.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { realEstateVertical } from "../lib/industries/content/realestate.ts";
import { checkCompleteness } from "../lib/industries/completeness.ts";
import { recommendSystem } from "../lib/industries/recommend.ts";
import { VERTICAL_SLUGS, VERTICAL_ROUTES } from "../lib/industries/types.ts";
import { realestateConfig } from "../components/demos/data/realestate.ts";

const v = realEstateVertical;

describe("real estate vertical", () => {
  it("passes the publish completeness gate", () => {
    const result = checkCompleteness(v);
    const failing = result.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`);
    assert.deepEqual(failing, [], "completeness checks failed");
    assert.equal(result.complete, true);
  });

  it("is registered in the slug list and the route map", () => {
    assert.ok(VERTICAL_SLUGS.includes("real-estate"));
    assert.equal(VERTICAL_ROUTES["real-estate"], "/industries/realestate");
    assert.equal(v.slug, "real-estate");
  });

  it("points at a demo that actually exists", () => {
    // The retail vertical shipped with demoSlug "retail" after its demo was
    // deleted, so every demo CTA on the page 301'd back to the page itself.
    // This assertion is what would have caught it.
    assert.equal(v.demoSlug, realestateConfig.slug);
    assert.equal(v.hero.demoCta.href, `/demos/${realestateConfig.slug}`);
    for (const cta of v.ctas.secondary) {
      if (cta.href.startsWith("/demos/")) {
        assert.equal(cta.href, `/demos/${realestateConfig.slug}`, `stale demo href: ${cta.label}`);
      }
    }
  });

  it("every workflow stage names a real system", () => {
    const names = new Set(v.systems.map((s) => s.name));
    for (const stage of v.workflow.stages) {
      assert.ok(names.has(stage.system), `stage "${stage.id}" names unknown system "${stage.system}"`);
    }
  });

  it("every system appears in at least one workflow stage", () => {
    const used = new Set(v.workflow.stages.map((s) => s.system));
    for (const system of v.systems) {
      assert.ok(used.has(system.name), `system "${system.id}" is never referenced by a stage`);
    }
  });

  it("every workflow integration is in the integrations list", () => {
    const known = new Set(v.integrations.items.map((i) => i.name));
    for (const stage of v.workflow.stages) {
      for (const name of stage.integrations) {
        assert.ok(known.has(name), `stage "${stage.id}" names unlisted integration "${name}"`);
      }
    }
  });

  it("every system integration is in the integrations list", () => {
    const known = new Set(v.integrations.items.map((i) => i.name));
    for (const system of v.systems) {
      for (const name of system.integrations) {
        assert.ok(known.has(name), `system "${system.id}" names unlisted integration "${name}"`);
      }
    }
  });

  it("every assessment recommendation resolves to a real system", () => {
    const ids = new Set(v.systems.map((s) => s.id));
    for (const rule of v.assessment.recommendations) {
      assert.ok(ids.has(rule.systemId), `recommendation targets unknown system "${rule.systemId}"`);
    }
    assert.ok(ids.has(v.assessment.fallbackSystemId), "fallbackSystemId is not a real system");
  });

  it("carries no leftover retail copy", () => {
    assert.doesNotMatch(JSON.stringify(v), /retail/i);
  });
});

describe("real estate assessment matcher", () => {
  const bottleneck = realEstateVertical.assessment.questions.find(
    (q) => q.id === "biggest-bottleneck",
  );

  it("has a bottleneck question with one option per recommendation", () => {
    assert.ok(bottleneck?.options, "biggest-bottleneck question is missing its options");
    assert.equal(bottleneck.options.length, v.assessment.recommendations.length);
  });

  it("routes each bottleneck option to its intended system", () => {
    // recommendSystem flattens EVERY answer into one haystack and takes the
    // first match, so this walks the real matcher rather than trusting that
    // the keywords look distinct.
    const expected = [
      "lead-response",
      "showing-coordination",
      "listing-pipeline",
      "transaction-coordination",
      "sphere-engine",
      "performance-platform",
    ];
    bottleneck!.options!.forEach((option, i) => {
      const picked = recommendSystem(v, { "biggest-bottleneck": option });
      assert.equal(picked.id, expected[i], `option "${option}" resolved to "${picked.id}"`);
    });
  });

  it("keeps its keywords out of every other question's options", () => {
    // A keyword that also appears in an unrelated option would let that
    // question hijack the recommendation.
    const others = v.assessment.questions
      .filter((q) => q.id !== "biggest-bottleneck")
      .flatMap((q) => q.options ?? [])
      .join(" ")
      .toLowerCase();
    for (const rule of v.assessment.recommendations) {
      for (const keyword of rule.keywords) {
        assert.ok(
          !others.includes(keyword.toLowerCase()),
          `keyword "${keyword}" also appears in another question's options`,
        );
      }
    }
  });

  it("falls back when nothing matches", () => {
    const picked = recommendSystem(v, { "brokerage-type": "Solo agent" });
    assert.equal(picked.id, v.assessment.fallbackSystemId);
  });
});
