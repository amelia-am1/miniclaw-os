import { test, expect } from "vitest";
import { existsSync } from "node:fs";

test("index.ts exists", () => {
  expect(existsSync(import.meta.dir + "/index.ts")).toBe(true);
});

test("plugin has required structure", () => {
  expect(existsSync(import.meta.dir + "/src/vault.ts")).toBe(true);
});
