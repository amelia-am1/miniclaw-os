import { test, expect } from "vitest";
import register from "./index.js";
import { createContributeTools } from "./tools/definitions.js";
import { registerContributeCommands } from "./cli/commands.js";
import { CONTRIBUTION_GUIDELINES } from "./src/guidelines.js";
import { resolveConfig } from "./src/config.js";
import {
  sanitizeSlug,
  sanitizeTitle,
  sanitizeBody,
} from "./src/sanitize.js";

test("register is a function", () => {
  expect(typeof register).toBe("function");
});

test("createContributeTools returns an array", () => {
  const tools = createContributeTools(
    { upstreamRepo: "test/repo", forkRemote: "origin", agentName: "test-agent", ghUsername: "test-user" },
    { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as any,
  );
  expect(Array.isArray(tools)).toBe(true);
});

test("createContributeTools includes expected tools", () => {
  const tools = createContributeTools(
    { upstreamRepo: "test/repo", forkRemote: "origin", agentName: "test-agent", ghUsername: "test-user" },
    { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as any,
  );
  const names = tools.map((t) => t.name);
  expect(names).toContain("contribute_scaffold_plugin");
  expect(names).toContain("contribute_pr");
  expect(names).toContain("contribute_bug_report");
  expect(names).toContain("contribute_feature_request");
  expect(names).toContain("contribute_guidelines");
  expect(names).toContain("contribute_status");
});

test("registerContributeCommands is a function", () => {
  expect(typeof registerContributeCommands).toBe("function");
});

test("CONTRIBUTION_GUIDELINES is a non-empty string", () => {
  expect(typeof CONTRIBUTION_GUIDELINES).toBe("string");
  expect(CONTRIBUTION_GUIDELINES.length).toBeGreaterThan(0);
});

test("CONTRIBUTION_GUIDELINES contains issue+PR rule", () => {
  expect(CONTRIBUTION_GUIDELINES).toContain("NO issue of ANY kind without a matching PR");
});

test("CONTRIBUTION_GUIDELINES contains attribution section", () => {
  expect(CONTRIBUTION_GUIDELINES).toContain("Attribution (automatic)");
  expect(CONTRIBUTION_GUIDELINES).toContain("Agent name");
  expect(CONTRIBUTION_GUIDELINES).toContain("GitHub username");
});

test("CONTRIBUTION_GUIDELINES contains pre-flight checklist", () => {
  expect(CONTRIBUTION_GUIDELINES).toContain("Pre-PR Checklist");
  expect(CONTRIBUTION_GUIDELINES).toContain("Test files added or updated");
  expect(CONTRIBUTION_GUIDELINES).toContain("Security check clean");
});

test("CONTRIBUTION_GUIDELINES mentions test stub requirement in plugin structure", () => {
  expect(CONTRIBUTION_GUIDELINES).toContain("cli/commands.test.ts");
  expect(CONTRIBUTION_GUIDELINES).toContain("smoke.test.ts");
});

// --- resolveConfig ---

test("resolveConfig returns defaults for empty input", () => {
  const cfg = resolveConfig({});
  expect(cfg.upstreamRepo).toBe("augmentedmike/miniclaw-os");
  expect(cfg.forkRemote).toBe("origin");
  expect(typeof cfg.agentName).toBe("string");
  expect(cfg.agentName.length).toBeGreaterThan(0);
  expect(typeof cfg.ghUsername).toBe("string");
});

test("resolveConfig respects explicit values", () => {
  const cfg = resolveConfig({
    upstreamRepo: "custom/repo",
    forkRemote: "myfork",
    agentName: "my-agent",
    ghUsername: "my-user",
  });
  expect(cfg.upstreamRepo).toBe("custom/repo");
  expect(cfg.forkRemote).toBe("myfork");
  expect(cfg.agentName).toBe("my-agent");
  expect(cfg.ghUsername).toBe("my-user");
});

// --- sanitizeSlug ---

test("sanitizeSlug keeps a valid slug", () => {
  expect(sanitizeSlug("valid-name", "test")).toBe("valid-name");
});

test("sanitizeSlug strips command injection characters", () => {
  const result = sanitizeSlug("$(rm -rf /)", "test");
  expect(result).not.toContain("$");
  expect(result).not.toContain("(");
  expect(result).not.toContain(")");
  expect(result).not.toContain("/");
});

test("sanitizeSlug rejects SQL injection", () => {
  expect(() => sanitizeSlug("; drop table", "test")).toThrow();
});

// --- sanitizeTitle ---

test("sanitizeTitle keeps a normal title", () => {
  expect(sanitizeTitle("normal title")).toBe("normal title");
});

test("sanitizeTitle strips backticks", () => {
  const result = sanitizeTitle("title`injection`here");
  expect(result).not.toContain("`");
});

test("sanitizeTitle strips shell metacharacters", () => {
  const result = sanitizeTitle("hello $(whoami) world");
  expect(result).not.toContain("$");
  expect(result).not.toContain("(");
  expect(result).not.toContain(")");
});

// --- sanitizeBody ---

test("sanitizeBody strips dollar signs", () => {
  const result = sanitizeBody("body with $variable");
  expect(result).not.toContain("$");
});

test("sanitizeBody strips backticks", () => {
  const result = sanitizeBody("some `code` here");
  expect(result).not.toContain("`");
});

test("sanitizeBody strips backslashes", () => {
  const result = sanitizeBody("path\\to\\file");
  expect(result).not.toContain("\\");
});
