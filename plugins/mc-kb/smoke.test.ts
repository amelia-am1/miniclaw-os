import { test, expect } from "bun:test";
import { existsSync } from "node:fs";

test("index.ts exists", () => {
  expect(existsSync(import.meta.dir + "/index.ts")).toBe(true);
});

test("plugin has required structure", () => {
  expect(existsSync(import.meta.dir + "/src/store.ts")).toBe(true);
  expect(existsSync(import.meta.dir + "/src/search.ts")).toBe(true);
  expect(existsSync(import.meta.dir + "/src/embedder.ts")).toBe(true);
});
