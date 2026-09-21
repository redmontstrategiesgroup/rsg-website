import "./_alias-hook.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return routeFiles(p);
    return d.name === "route.ts" ? [path.relative(root, p).split(path.sep).join("/")] : [];
  });
}

describe("v1 route index", () => {
  it("matches the filesystem (run `npm run gen:v1-index` if this fails)", async () => {
    const { expectedRouteFiles, V1_ROUTES } = await import("../lib/apiv1/openapi-routes.ts");
    const onDisk = routeFiles(path.join(root, "app/api/v1"))
      .filter((f) => !f.endsWith("openapi.json/route.ts"))
      .sort();
    assert.deepEqual(expectedRouteFiles(), onDisk, "lib/apiv1/openapi-routes.ts is stale — run `npm run gen:v1-index`");
    assert.equal(V1_ROUTES.length, onDisk.length);
    for (const r of V1_ROUTES) {
      assert.ok(r.path.startsWith("/api/v1/"), r.path);
      assert.ok(!r.path.includes("["), r.path);
      assert.equal(typeof r.load, "function");
    }
    assert.ok(V1_ROUTES.some((r) => r.path === "/api/v1/tickets/{id}"));
    assert.ok(V1_ROUTES.some((r) => r.path === "/api/v1/admin/{entity}/{id}"));
    assert.ok(V1_ROUTES.some((r) => r.path === "/api/v1/webhooks/{id}/deliveries/{did}/replay"));
  });
});
