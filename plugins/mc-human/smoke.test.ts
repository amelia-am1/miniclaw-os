import { test, expect } from "vitest";
import register from "./index.js";
import { verifyMacOsSetup } from "./src/macos-system-setup.js";

test("register is a function", () => {
  expect(typeof register).toBe("function");
});

test("verifyMacOsSetup returns status object", async () => {
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  const result = await verifyMacOsSetup(logger);
  expect(result).toHaveProperty("vnc_reachable");
  expect(result).toHaveProperty("system_sleep_disabled");
  expect(result).toHaveProperty("display_sleep_configured");
  expect(result).toHaveProperty("screensaver_disabled");
  expect(result).toHaveProperty("all_ok");
  expect(typeof result.vnc_reachable).toBe("boolean");
});
