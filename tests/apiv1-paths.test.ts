import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isApiV1Path } from "../lib/apiv1/paths.ts";

describe("isApiV1Path", () => {
  it("matches the v1 tree only", () => {
    assert.equal(isApiV1Path("/api/v1/me"), true);
    assert.equal(isApiV1Path("/api/v1/openapi.json"), true);
    assert.equal(isApiV1Path("/api/v1"), true);
    assert.equal(isApiV1Path("/api/v10/x"), false);
    assert.equal(isApiV1Path("/api/portal/apikeys"), false);
    assert.equal(isApiV1Path("/v1/me"), false);
  });
});
