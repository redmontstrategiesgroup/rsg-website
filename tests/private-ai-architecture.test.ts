import test from "node:test";
import assert from "node:assert/strict";
import { buildSimulatedArchitecture } from "../lib/private-ai/architecture.ts";

test("buildSimulatedArchitecture returns disclaimer and components", () => {
  const arch = buildSimulatedArchitecture({
    businessType: "Home services",
    systemType: "internal_assistant",
    deployment: "fully_local",
    dataSources: ["Company documents", "CRM"],
    privacyControls: ["Role-based permissions", "Audit logs"],
  });
  assert.match(arch.recommendedDeployment, /Fully Local/i);
  assert.ok(arch.coreComponents.length >= 3);
  assert.ok(arch.integrations.includes("CRM"));
  assert.match(arch.disclaimer, /illustrative/i);
  assert.ok(!/HIPAA|SOC 2|automatically compliant/i.test(arch.disclaimer));
});
