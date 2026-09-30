import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Next 16 removed `next lint`; this is the flat-config equivalent of the old
// .eslintrc.json ("next/core-web-vitals" + "next/typescript").
export default defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**",
    "audit-out/**",
  ]),
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // eslint-config-next 16 ships the React Compiler lint rules as errors.
      // The app does not use the compiler, and the flagged code (fetch-on-
      // mount setState, refs handed to createElement) predates the upgrade
      // and works; keep them visible as warnings until they're refactored.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
    },
  },
]);
