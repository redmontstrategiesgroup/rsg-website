/**
 * Registers a `@/` -> repo-root resolve hook for `node --test`, so test
 * files can import modules that use the `@/lib/...` alias (which only
 * Next.js's bundler otherwise understands). Import this module FIRST, for
 * its side effect, before importing anything that resolves `@/` specifiers.
 *
 * Lifted out of tests/webhooks.test.ts so other hermetic handler tests
 * (e.g. tests/apiv1-isolation.test.ts) can share it without duplicating it.
 */
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import * as nodeModule from "node:module";

type ResolveHook = (
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context?: unknown) => unknown,
) => unknown;
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
};
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    let spec = specifier;
    if (spec.startsWith("@/")) spec = pathToFileURL(path.join(repoRoot, spec.slice(2))).href;
    try {
      return nextResolve(spec, context);
    } catch (err) {
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        try {
          return nextResolve(`${spec}${suffix}`, context);
        } catch {
          /* try the next candidate */
        }
      }
      throw err;
    }
  },
});
