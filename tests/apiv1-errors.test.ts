import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError, errorBody, notFound, toApiError } from "../lib/apiv1/errors.ts";

describe("ApiError", () => {
  it("carries status, code, details", () => {
    const e = new ApiError(422, "validation_failed", "Bad input.", { field: ["x"] });
    assert.equal(e.status, 422);
    assert.equal(e.code, "validation_failed");
    assert.deepEqual(errorBody(e, "c-1"), {
      error: { code: "validation_failed", message: "Bad input.", details: { field: ["x"] }, correlation_id: "c-1" },
    });
  });
  it("omits details when absent", () => {
    assert.deepEqual(errorBody(notFound(), "c"), {
      error: { code: "not_found", message: "Not found.", correlation_id: "c" },
    });
  });
  it("wraps unknown errors as internal without leaking the message", () => {
    const e = toApiError(new Error("pg: relation missing"));
    assert.equal(e.status, 500);
    assert.equal(e.code, "internal");
    assert.equal(e.message, "Something went wrong.");
    const passthrough = new ApiError(409, "conflict", "x");
    assert.equal(toApiError(passthrough), passthrough);
  });
});
