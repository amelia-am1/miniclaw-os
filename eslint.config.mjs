/**
 * ESLint config — guards against model hallucination.
 *
 * This is NOT a style linter. Every rule here catches a class of bug
 * that LLMs produce: unreachable code, impossible conditions, dead branches,
 * nonsensical expressions, and excessive complexity that hides errors.
 *
 * SonarJS provides cognitive complexity (how hard is this to understand?)
 * and catches code smells that indicate hallucinated logic.
 */

import eslintJs from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import sonarjs from "eslint-plugin-sonarjs";

export default [
  // ── Ignore patterns ──────────────────────────────────────────────────
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/web/standalone.mjs",
      "**/.next/**",
      "**/out/**",
    ],
  },

  // ── Base JS rules — catch hallucinated logic ─────────────────────────
  {
    files: ["plugins/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      sonarjs,
    },
    rules: {
      // ── Unreachable / dead code (hallucination red flags) ──────────
      "no-unreachable": "error",
      "no-unreachable-loop": "error",
      "no-constant-condition": "error",
      "no-constant-binary-expression": "error",
      "no-self-compare": "error",
      "no-self-assign": "error",
      "no-duplicate-case": "error",
      "no-dupe-else-if": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-empty-pattern": "error",
      "no-ex-assign": "error",
      "no-func-assign": "error",
      "no-import-assign": "error",
      "no-loss-of-precision": "error",
      "no-unsafe-negation": "error",
      "no-unsafe-optional-chaining": "error",
      "use-isnan": "error",
      "valid-typeof": "error",

      // ── Logic errors LLMs produce ──────────────────────────────────
      "no-fallthrough": "error",
      "no-case-declarations": "error",
      "no-sparse-arrays": "error",
      "no-template-curly-in-string": "warn",
      "no-unmodified-loop-condition": "error",
      "no-unused-expressions": ["error", { allowShortCircuit: true, allowTernary: true }],
      "no-useless-return": "error",
      "no-useless-catch": "error",
      "no-useless-escape": "error",
      "no-useless-concat": "error",
      "no-useless-computed-key": "error",
      "no-useless-rename": "error",
      "no-with": "error",
      "no-sequences": "error",
      "no-throw-literal": "error",
      "no-unneeded-ternary": "error",
      "no-lonely-if": "warn",

      // ── Complexity bounds — flag hallucinated spaghetti ────────────
      "complexity": ["warn", 15],
      "max-depth": ["warn", 4],
      "max-nested-callbacks": ["warn", 3],
      "max-params": ["warn", 5],

      // ── TypeScript-specific hallucination guards ───────────────────
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",  // legitimate in our codebase
      "@typescript-eslint/no-require-imports": "off",     // vitest configs use require()

      // ── SonarJS — cognitive complexity + code smell detection ──────
      //    These catch the hallucination patterns that basic ESLint misses:
      //    duplicated logic, impossible conditions, dead stores, etc.
      "sonarjs/cognitive-complexity": ["warn", 15],
      "sonarjs/no-duplicate-string": ["warn", { threshold: 4 }],
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/no-identical-expressions": "error",
      "sonarjs/no-collapsible-if": "warn",
      "sonarjs/no-collection-size-mischeck": "error",
      "sonarjs/no-redundant-jump": "warn",
      "sonarjs/no-same-line-conditional": "warn",
      "sonarjs/no-unused-collection": "warn",
      "sonarjs/prefer-immediate-return": "warn",
      "sonarjs/prefer-single-boolean-return": "warn",
      "sonarjs/no-inverted-boolean-check": "warn",
      "sonarjs/no-nested-template-literals": "warn",
      "sonarjs/no-all-duplicated-branches": "error",
    },
  },
];
