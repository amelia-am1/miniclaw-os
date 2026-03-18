import { test, expect } from "vitest";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("index.ts exists", () => {
  expect(existsSync(__dirname + "/index.ts")).toBe(true);
});

test("plugin has required structure", () => {
  expect(existsSync(__dirname + "/openclaw.plugin.json")).toBe(true);
  expect(existsSync(__dirname + "/package.json")).toBe(true);
  expect(existsSync(__dirname + "/src/vault.ts")).toBe(true);
  expect(existsSync(__dirname + "/src/client.ts")).toBe(true);
  expect(existsSync(__dirname + "/cli/commands.ts")).toBe(true);
  expect(existsSync(__dirname + "/tools/definitions.ts")).toBe(true);
});

test("openclaw.plugin.json has correct id", async () => {
  const config = JSON.parse(
    (await import("node:fs")).readFileSync(__dirname + "/openclaw.plugin.json", "utf8")
  );
  expect(config.id).toBe("mc-x");
  expect(config.name).toContain("X");
});

test("package.json has openclaw extension entry", async () => {
  const pkg = JSON.parse(
    (await import("node:fs")).readFileSync(__dirname + "/package.json", "utf8")
  );
  expect(pkg.openclaw.extensions).toContain("./index.ts");
  expect(pkg.type).toBe("module");
});

test("client exports XClient class", async () => {
  const mod = await import("./src/client.js");
  expect(mod.XClient).toBeDefined();
  expect(typeof mod.XClient).toBe("function");
});

test("vault exports getBearerToken and saveBearerToken", async () => {
  const mod = await import("./src/vault.js");
  expect(typeof mod.getBearerToken).toBe("function");
  expect(typeof mod.saveBearerToken).toBe("function");
});

test("tools definitions exports createXTools", async () => {
  const mod = await import("./tools/definitions.js");
  expect(typeof mod.createXTools).toBe("function");

  const mockLogger = { info: () => {}, warn: () => {}, error: () => {} };
  const tools = mod.createXTools(mockLogger);
  expect(Array.isArray(tools)).toBe(true);
  expect(tools.length).toBe(3);

  const names = tools.map((t: { name: string }) => t.name);
  expect(names).toContain("x_post");
  expect(names).toContain("x_timeline");
  expect(names).toContain("x_reply");
});

test("CLI commands exports registerXCommands", async () => {
  const mod = await import("./cli/commands.js");
  expect(typeof mod.registerXCommands).toBe("function");
});
