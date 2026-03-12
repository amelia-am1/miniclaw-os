import { test, expect } from "bun:test";
import { existsSync } from "node:fs";
import { resolveConfig } from "./src/config.js";

test("index.ts exists", () => {
  expect(existsSync(import.meta.dir + "/index.ts")).toBe(true);
});

test("resolveConfig returns defaults", () => {
  const cfg = resolveConfig({});
  expect(cfg).toBeDefined();
  expect(typeof cfg.domains).toBe("object");
});
