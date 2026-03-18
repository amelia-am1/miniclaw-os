import type { AnyAgentTool } from "openclaw/plugin-sdk";
import type { ContributeConfig } from "../src/config.js";
import { CONTRIBUTION_GUIDELINES } from "../src/guidelines.js";
import { runPreflight, formatPreflight } from "../src/preflight.js";
import {
  sanitizePluginName,
  sanitizeBranchTopic,
  sanitizeTitle,
  sanitizeBody,
  sanitizeFreeText,
  validateRepo,
  validateRemote,
} from "../src/sanitize.js";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

type Logger = { info(m: string): void; warn(m: string): void; error(m: string): void };

function ok(text: string) {
  return { content: [{ type: "text" as const, text: text.trim() }], details: {} };
}

/**
 * Safe shell execution — uses execFileSync (no shell interpolation).
 * Arguments are passed as an array, never interpolated into a string.
 */
function run(cmd: string, args: string[], cwd?: string): string {
  return execFileSync(cmd, args, { encoding: "utf-8", cwd, timeout: 30_000 }).trim();
}

/**
 * Write body to a temp file and pass via --body-file to gh CLI.
 * This avoids all shell interpolation of user-provided content.
 */
function ghWithBodyFile(
  subcmd: string[],
  body: string,
  extraArgs: string[],
  cwd?: string
): string {
  const tmpFile = path.join(os.tmpdir(), `mc-contribute-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
  try {
    fs.writeFileSync(tmpFile, body, "utf-8");
    return run("gh", [...subcmd, "--body-file", tmpFile, ...extraArgs], cwd);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

/**
 * Collect clone identity for upstream bug reports.
 * Includes hostname, bot ID (if available), and install path.
 */
function collectCloneIdentity(): string {
  const hostname = os.hostname();
  const stateDir = process.env.OPENCLAW_STATE_DIR || "(not set)";

  let botId = "(unknown)";
  try {
    const agentConfig = path.join(stateDir, "agents", "main", "agent", "agent.json");
    if (fs.existsSync(agentConfig)) {
      const cfg = JSON.parse(fs.readFileSync(agentConfig, "utf-8"));
      botId = cfg.id || cfg.botId || cfg.name || "(unknown)";
    }
  } catch {}

  return `- Clone hostname: ${hostname}\n- Bot ID: ${botId}\n- State dir: ${stateDir}`;
}

/**
 * Build the attribution line from config (auto-resolved).
 */
function buildAttribution(cfg: ContributeConfig): string {
  return `Created by ${cfg.agentName} (@${cfg.ghUsername})`;
}

/**
 * Check if the current branch is a contribution branch (not main).
 * Used to gate issue tools — they should only work when a PR branch is ready.
 */
function isOnContribBranch(repoRoot: string): boolean {
  try {
    const branch = run("git", ["branch", "--show-current"], repoRoot);
    return branch !== "main" && branch !== "master" && branch.length > 0;
  } catch {
    return false;
  }
}

/**
 * Gate message returned when trying to file an issue without a PR branch.
 */
const GATE_MESSAGE =
  `BLOCKED: You must have a contribution branch with changes before filing issues.\n\n` +
  `The mc-contribute rule is: NO issue without a matching PR.\n\n` +
  `Steps:\n` +
  `1. Create a branch: contribute_branch or 'mc mc-contribute branch <topic>'\n` +
  `2. Make your changes and commit them\n` +
  `3. Then file the issue — it will be submitted alongside your PR.\n\n` +
  `This prevents orphaned issues with no code to back them up.`;

interface DuplicateMatch {
  number: number;
  title: string;
  url: string;
  state: string;
}

/**
 * Search for existing issues or PRs that may match a given title/query.
 */
function findDuplicates(
  repo: string,
  kind: "issue" | "pr",
  query: string,
  logger: Logger,
): DuplicateMatch[] {
  const searchCmd = kind === "pr" ? "pr" : "issue";
  try {
    const raw = run("gh", [
      searchCmd, "list",
      "--repo", repo,
      "--search", query,
      "--state", "open",
      "--json", "number,title,url,state",
      "--limit", "5",
    ]);
    if (!raw) return [];
    const results = JSON.parse(raw) as DuplicateMatch[];
    logger.info(`Duplicate check (${kind}): found ${results.length} match(es) for "${query}"`);
    return results;
  } catch {
    logger.warn(`Duplicate check (${kind}) failed for query "${query}" — proceeding anyway`);
    return [];
  }
}

/**
 * Comment on an existing issue or PR instead of creating a duplicate.
 */
function commentOnExisting(
  repo: string,
  kind: "issue" | "pr",
  number: number,
  body: string,
  logger: Logger,
): string {
  const subcmd = kind === "pr" ? "pr" : "issue";
  try {
    const result = ghWithBodyFile(
      [subcmd, "comment", String(number)],
      body,
      ["--repo", repo],
    );
    logger.info(`Commented on ${kind} #${number}`);
    return result;
  } catch (err: unknown) {
    const e = err as { stderr?: string };
    logger.warn(`Failed to comment on ${kind} #${number}: ${e.stderr || "unknown"}`);
    return "";
  }
}

/**
 * Format duplicate matches for display to the agent.
 */
function formatDuplicates(matches: DuplicateMatch[], _kind: string): string {
  return matches
    .map((m) => `  #${m.number}: ${m.title} (${m.url})`)
    .join("\n");
}

export function createContributeTools(cfg: ContributeConfig, logger: Logger): AnyAgentTool[] {
  const upstreamRepo = validateRepo(cfg.upstreamRepo);
  const forkRemote = validateRemote(cfg.forkRemote);
  const attribution = buildAttribution(cfg);

  return [
    // ── Scaffold a new plugin ──────────────────────────────────────────
    {
      name: "contribute_scaffold_plugin",
      label: "contribute_scaffold_plugin",
      description:
        "Scaffold a new MiniClaw plugin with the correct directory structure, " +
        "openclaw.plugin.json, package.json, index.ts, tools/, cli/, and a test stub. " +
        "Returns the file paths created so the agent can fill in the implementation.",
      parameters: {
        type: "object",
        required: ["pluginName", "description", "brainRegion"],
        properties: {
          pluginName: {
            type: "string",
            description: "Plugin name without mc- prefix (e.g. 'weather' becomes mc-weather)",
          },
          description: {
            type: "string",
            description: "One-sentence description of what the plugin does",
          },
          brainRegion: {
            type: "string",
            description: "Cognitive category: planning, memory, communication, creation, security, utility",
          },
        },
      },
      async execute(_id: string, params: unknown) {
        const p = params as Record<string, string>;
        const name = sanitizePluginName(p.pluginName);
        const fullName = `mc-${name}`;
        const description = sanitizeFreeText(p.description, "description");
        const brainRegion = sanitizePluginName(p.brainRegion.replace(/^mc-/, ""));
        const repoRoot = run("git", ["rev-parse", "--show-toplevel"]);
        const pluginDir = path.join(repoRoot, "plugins", fullName);

        if (fs.existsSync(pluginDir)) {
          return ok(`Plugin ${fullName} already exists at ${pluginDir}`);
        }

        for (const sub of ["src", "tools", "cli", "docs"]) {
          fs.mkdirSync(path.join(pluginDir, sub), { recursive: true });
        }

        const cap = name.charAt(0).toUpperCase() + name.slice(1);

        fs.writeFileSync(
          path.join(pluginDir, "openclaw.plugin.json"),
          JSON.stringify(
            {
              id: fullName,
              name: `MiniClaw ${cap}`,
              description,
              version: "0.1.0",
              configSchema: {
                type: "object",
                additionalProperties: false,
                properties: {},
              },
            },
            null,
            2
          )
        );

        fs.writeFileSync(
          path.join(pluginDir, "package.json"),
          JSON.stringify(
            {
              name: fullName,
              version: "0.1.0",
              description,
              type: "module",
              main: "index.ts",
            },
            null,
            2
          )
        );

        fs.writeFileSync(
          path.join(pluginDir, "index.ts"),
          `import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { register${cap}Commands } from "./cli/commands.js";
import { create${cap}Tools } from "./tools/definitions.js";

export default function register(api: OpenClawPluginApi): void {
  api.logger.info("${fullName} loaded");

  api.registerCli((ctx) => {
    register${cap}Commands({ program: ctx.program, logger: api.logger });
  });

  for (const tool of create${cap}Tools(api.logger)) {
    api.registerTool(tool);
  }
}
`
        );

        fs.writeFileSync(
          path.join(pluginDir, "tools", "definitions.ts"),
          `import type { AnyAgentTool } from "openclaw/plugin-sdk";

type Logger = { info(m: string): void; warn(m: string): void; error(m: string): void };

export function create${cap}Tools(logger: Logger): AnyAgentTool[] {
  return [
    // TODO: Add your tools here
  ];
}
`
        );

        fs.writeFileSync(
          path.join(pluginDir, "cli", "commands.ts"),
          `import type { Command } from "commander";

type Logger = { info(m: string): void; warn(m: string): void; error(m: string): void };

export function register${cap}Commands(
  ctx: { program: Command; logger: Logger }
): void {
  const { program } = ctx;

  program
    .command("${fullName}")
    .description("${description}");

  // TODO: Add subcommands here
}
`
        );

        // Generate cli/commands.test.ts stub
        fs.writeFileSync(
          path.join(pluginDir, "cli", "commands.test.ts"),
          `import { test, expect } from "vitest";
import { register${cap}Commands } from "./commands.js";

test("register${cap}Commands is a function", () => {
  expect(typeof register${cap}Commands).toBe("function");
});

// TODO: Add tests for your CLI commands
`
        );

        // Generate smoke.test.ts
        fs.writeFileSync(
          path.join(pluginDir, "smoke.test.ts"),
          `import { test, expect } from "vitest";
import register from "./index.js";

test("register is a function", () => {
  expect(typeof register).toBe("function");
});

// TODO: Add smoke tests for your plugin
`
        );

        fs.writeFileSync(
          path.join(pluginDir, "docs", "README.md"),
          `# ${fullName}\n\n**Brain region:** ${brainRegion}\n\n${description}\n`
        );

        const files = [
          "openclaw.plugin.json",
          "package.json",
          "index.ts",
          "tools/definitions.ts",
          "cli/commands.ts",
          "cli/commands.test.ts",
          "smoke.test.ts",
          "docs/README.md",
        ];

        logger.info(`Scaffolded ${fullName} at ${pluginDir}`);
        return ok(
          `Scaffolded ${fullName} at plugins/${fullName}/\n\n` +
            `Files created:\n${files.map((f) => `  ${fullName}/${f}`).join("\n")}\n\n` +
            `Next steps:\n` +
            `1. Add tools in tools/definitions.ts\n` +
            `2. Add CLI commands in cli/commands.ts\n` +
            `3. Add config properties in openclaw.plugin.json\n` +
            `4. Write tests in cli/commands.test.ts and smoke.test.ts\n` +
            `5. Test with: mc plugin test ${fullName}`
        );
      },
    } as AnyAgentTool,

    // ── Prepare a contribution branch ──────────────────────────────────
    {
      name: "contribute_branch",
      label: "contribute_branch",
      description:
        "Create a feature branch for a contribution. Names the branch " +
        "following the convention: contrib/<plugin-or-topic>.",
      parameters: {
        type: "object",
        required: ["topic"],
        properties: {
          topic: {
            type: "string",
            description: "Branch topic slug (e.g. 'mc-weather' or 'fix-kb-search')",
          },
        },
      },
      async execute(_id: string, params: unknown) {
        const p = params as Record<string, string>;
        const slug = sanitizeBranchTopic(p.topic);
        const branch = `contrib/${slug}`;
        const repoRoot = run("git", ["rev-parse", "--show-toplevel"]);

        run("git", ["checkout", "main"], repoRoot);
        try {
          run("git", ["pull", "--ff-only"], repoRoot);
        } catch {}
        run("git", ["checkout", "-b", branch], repoRoot);

        logger.info(`Created branch ${branch}`);
        return ok(
          `Created branch: ${branch}\n\n` +
            `You're now on a clean branch from main.\n` +
            `Make your changes, then use contribute_pr to submit.`
        );
      },
    } as AnyAgentTool,

    // ── Run security check ─────────────────────────────────────────────
    {
      name: "contribute_security_check",
      label: "contribute_security_check",
      description:
        "Run the MiniClaw security scanner on the repo. " +
        "Checks for hardcoded secrets, API keys, tokens, and PII.",
      parameters: {
        type: "object",
        required: [],
        properties: {
          scope: {
            type: "string",
            enum: ["staged", "all"],
            description: "Scan staged files only (default) or full repo",
          },
        },
      },
      async execute(_id: string, params: unknown) {
        const p = params as Record<string, string>;
        const repoRoot = run("git", ["rev-parse", "--show-toplevel"]);
        const script = path.join(repoRoot, "scripts", "security-check.sh");
        const args = p.scope === "all" ? [script, "--all"] : [script];

        try {
          const output = run("bash", args, repoRoot);
          return ok(output);
        } catch (err: unknown) {
          const e = err as { stdout?: string; stderr?: string };
          return ok(
            `SECURITY ISSUES FOUND:\n\n${e.stdout || ""}\n${e.stderr || ""}\n\n` +
              `Fix these before committing.`
          );
        }
      },
    } as AnyAgentTool,

    // ── Submit a PR ────────────────────────────────────────────────────
    {
      name: "contribute_pr",
      label: "contribute_pr",
      description:
        "Push the current branch and create a pull request to the upstream " +
        "miniclaw-os repo. Runs pre-flight checks first (tests in diff, tests passing, " +
        "docs updated, security clean). Blocks if any check fails. " +
        "Automatically adds agent attribution.",
      parameters: {
        type: "object",
        required: ["title", "summary"],
        properties: {
          title: {
            type: "string",
            description: "PR title (short, under 70 chars)",
          },
          summary: {
            type: "string",
            description: "What this PR does (1-3 bullet points)",
          },
          pluginsAffected: {
            type: "string",
            description: "Comma-separated list of plugins this PR touches",
          },
        },
      },
      async execute(_id: string, params: unknown) {
        const p = params as Record<string, string>;
        const title = sanitizeTitle(p.title);
        const summary = sanitizeBody(p.summary);
        const plugins = p.pluginsAffected ? sanitizeFreeText(p.pluginsAffected, "plugins") : "N/A";
        const repoRoot = run("git", ["rev-parse", "--show-toplevel"]);

        // Check for existing open PRs with similar title (agent coordination)
        const prMatches = findDuplicates(upstreamRepo, "pr", title, logger);
        if (prMatches.length > 0) {
          const identity = collectCloneIdentity();
          const commentBody =
            `## Duplicate PR attempt detected\n\n` +
            `Another agent attempted to open a PR with a similar title:\n` +
            `**"${title}"**\n\n` +
            `**Summary:** ${summary}\n\n` +
            `**${attribution}**\n\n` +
            `**Clone identity**\n${identity}\n\n` +
            `---\nDetected by mc-contribute duplicate check (ref: issue #63)`;
          commentOnExisting(upstreamRepo, "pr", prMatches[0].number, commentBody, logger);
          return ok(
            `Duplicate PR detected — commented on existing PR instead of creating a new one.\n\n` +
            `Existing PRs matching "${title}":\n${formatDuplicates(prMatches, "PR")}\n\n` +
            `A comment with your contribution details was added to PR #${prMatches[0].number}.`
          );
        }

        // Run pre-flight checklist (replaces the old security-only check)
        const preflight = runPreflight(repoRoot, logger);
        if (!preflight.passed) {
          return ok(
            `PR blocked — pre-flight checks failed:\n\n${formatPreflight(preflight)}\n\n` +
            `Fix all issues above before submitting.`
          );
        }

        // Push branch
        const branch = run("git", ["branch", "--show-current"], repoRoot);
        try {
          run("git", ["push", "-u", forkRemote, branch], repoRoot);
        } catch {
          return ok(`Failed to push branch ${branch}. Make sure your fork remote is set up.`);
        }

        // Create PR with attribution
        const body =
          `## Summary\n\n${summary}\n\n` +
          `## Plugin(s) affected\n\n${plugins}\n\n` +
          `## Pre-flight checklist\n\n` +
          `- [x] Test files in diff\n` +
          `- [x] All tests passing\n` +
          `- [x] Docs updated (if applicable)\n` +
          `- [x] Security check clean\n\n` +
          `## Security check\n\n- [x] Ran ./scripts/security-check.sh (passed)\n- [x] No secrets, tokens, or PII in this PR\n\n` +
          `## Attribution\n\n${attribution}\n\n` +
          `## Clone identity\n\n${collectCloneIdentity()}\n\n` +
          `---\nSubmitted via mc-contribute`;

        try {
          const prUrl = ghWithBodyFile(
            ["pr", "create"],
            body,
            ["--repo", upstreamRepo, "--title", title],
            repoRoot
          );
          logger.info(`PR created: ${prUrl}`);
          return ok(`PR created: ${prUrl}`);
        } catch (err: unknown) {
          const e = err as { stderr?: string };
          return ok(`Failed to create PR: ${e.stderr || "unknown error"}`);
        }
      },
    } as AnyAgentTool,

    // ── Check contribution status ──────────────────────────────────────
    {
      name: "contribute_status",
      label: "contribute_status",
      description:
        "Check the status of your contribution — current branch, " +
        "uncommitted changes, open PRs, and agent attribution.",
      parameters: {
        type: "object",
        required: [],
        properties: {},
      },
      async execute() {
        const repoRoot = run("git", ["rev-parse", "--show-toplevel"]);
        const branch = run("git", ["branch", "--show-current"], repoRoot);
        const status = run("git", ["status", "--short"], repoRoot);
        const log = run("git", ["log", "--oneline", "-5"], repoRoot);

        let prs = "none";
        try {
          prs = run("gh", ["pr", "list", "--repo", upstreamRepo, "--author", "@me", "--state", "open"], repoRoot);
          if (!prs) prs = "none";
        } catch {
          prs = "(could not check — gh auth may be needed)";
        }

        return ok(
          `Branch: ${branch}\n\n` +
            `Uncommitted changes:\n${status || "(clean)"}\n\n` +
            `Recent commits:\n${log}\n\n` +
            `Open PRs:\n${prs}\n\n` +
            `Agent: ${attribution}`
        );
      },
    } as AnyAgentTool,

    // ── Get contribution guidelines ────────────────────────────────────
    {
      name: "contribute_guidelines",
      label: "contribute_guidelines",
      description:
        "Get the full MiniClaw contribution guidelines — architecture rules, " +
        "code style, security requirements, branch naming, PR format, " +
        "pre-flight checklist, and attribution rules. " +
        "Read this FIRST before making any contribution.",
      parameters: {
        type: "object",
        required: [],
        properties: {},
      },
      async execute() {
        return ok(CONTRIBUTION_GUIDELINES);
      },
    } as AnyAgentTool,

    // ── File a bug report (GATED) ─────────────────────────────────────
    {
      name: "contribute_bug_report",
      label: "contribute_bug_report",
      description:
        "File a bug report on the miniclaw-os repo. GATED: You must be on a " +
        "contribution branch with a fix before filing. Automatically collects " +
        "environment info and adds agent attribution.",
      parameters: {
        type: "object",
        required: ["title", "whatHappened", "expected", "stepsToReproduce"],
        properties: {
          title: {
            type: "string",
            description: "Bug title (concise, descriptive)",
          },
          whatHappened: {
            type: "string",
            description: "What actually happened",
          },
          expected: {
            type: "string",
            description: "What should have happened",
          },
          stepsToReproduce: {
            type: "string",
            description: "Steps to reproduce (numbered list)",
          },
          pluginsInvolved: {
            type: "string",
            description: "Which plugin(s) are affected",
          },
        },
      },
      async execute(_id: string, params: unknown) {
        const repoRoot = run("git", ["rev-parse", "--show-toplevel"]);

        // GATE: Must be on a contribution branch
        if (!isOnContribBranch(repoRoot)) {
          return ok(GATE_MESSAGE);
        }

        const p = params as Record<string, string>;
        const title = sanitizeTitle(p.title);
        const whatHappened = sanitizeBody(p.whatHappened);
        const expected = sanitizeBody(p.expected);
        const steps = sanitizeBody(p.stepsToReproduce);
        const plugins = p.pluginsInvolved ? sanitizeFreeText(p.pluginsInvolved, "plugins") : "N/A";

        // Check for duplicates
        const bugMatches = findDuplicates(upstreamRepo, "issue", `[Bug] ${title}`, logger);
        if (bugMatches.length > 0) {
          const identity = collectCloneIdentity();
          const commentBody =
            `## Additional report from another clone\n\n` +
            `**What happened:** ${whatHappened}\n\n` +
            `**Expected:** ${expected}\n\n` +
            `**Steps:** ${steps}\n\n` +
            `**${attribution}**\n\n` +
            `**Clone identity**\n${identity}\n\n` +
            `---\nDuplicate detected by mc-contribute (ref: issue #63)`;
          commentOnExisting(upstreamRepo, "issue", bugMatches[0].number, commentBody, logger);
          return ok(
            `Duplicate bug report detected — commented on existing issue instead.\n\n` +
            `Existing issues matching "[Bug] ${title}":\n${formatDuplicates(bugMatches, "issue")}\n\n` +
            `Your report details were added as a comment on issue #${bugMatches[0].number}.`
          );
        }

        let macosVersion = "unknown";
        let nodeVersion = "unknown";
        let mcVersion = "unknown";
        let doctorOutput = "(mc-doctor not available)";

        try { macosVersion = run("sw_vers", ["-productVersion"]); } catch {}
        try { nodeVersion = run("node", ["--version"]); } catch {}
        try { mcVersion = run("mc", ["--version"]); } catch { mcVersion = "unknown"; }
        try { doctorOutput = run("mc-doctor", []); } catch { doctorOutput = "(failed)"; }

        const body =
          `**What happened?**\n${whatHappened}\n\n` +
          `**What did you expect?**\n${expected}\n\n` +
          `**Steps to reproduce**\n${steps}\n\n` +
          `**Environment**\n` +
          `- macOS version: ${macosVersion}\n` +
          `- Node version: ${nodeVersion}\n` +
          `- MiniClaw version: ${mcVersion}\n` +
          `- Plugin(s) involved: ${plugins}\n\n` +
          `**Attribution**\n${attribution}\n\n` +
          `**Clone identity**\n${collectCloneIdentity()}\n\n` +
          `**mc-doctor output**\n\n${doctorOutput}\n\n` +
          `---\nFiled via mc-contribute`;

        try {
          const issueUrl = ghWithBodyFile(
            ["issue", "create"],
            body,
            ["--repo", upstreamRepo, "--title", `[Bug] ${title}`, "--label", "bug"],
          );
          logger.info(`Bug report filed: ${issueUrl}`);
          return ok(`Bug report filed: ${issueUrl}`);
        } catch (err: unknown) {
          const e = err as { stderr?: string };
          return ok(`Failed to file bug report: ${e.stderr || "unknown error"}\n\nFile manually at: https://github.com/${upstreamRepo}/issues/new`);
        }
      },
    } as AnyAgentTool,

    // ── Request a feature (GATED) ─────────────────────────────────────
    {
      name: "contribute_feature_request",
      label: "contribute_feature_request",
      description:
        "Submit a feature request or plugin idea to miniclaw-os. GATED: You must " +
        "be on a contribution branch with an implementation before filing. " +
        "Automatically adds agent attribution.",
      parameters: {
        type: "object",
        required: ["title", "problem", "proposedSolution"],
        properties: {
          title: {
            type: "string",
            description: "Feature title",
          },
          problem: {
            type: "string",
            description: "What problem does this solve?",
          },
          proposedSolution: {
            type: "string",
            description: "How should it work?",
          },
          brainRegion: {
            type: "string",
            description: "Which brain region / plugin does this belong to?",
          },
          isNewPlugin: {
            type: "boolean",
            description: "Is this a proposal for a new plugin?",
          },
          pluginName: {
            type: "string",
            description: "If new plugin, proposed name (mc-???)",
          },
          exampleUsage: {
            type: "string",
            description: "Example CLI commands showing how it would work",
          },
        },
      },
      async execute(_id: string, params: unknown) {
        const repoRoot = run("git", ["rev-parse", "--show-toplevel"]);

        // GATE: Must be on a contribution branch
        if (!isOnContribBranch(repoRoot)) {
          return ok(GATE_MESSAGE);
        }

        const p = params as Record<string, unknown>;
        const title = sanitizeTitle(p.title as string);
        const problem = sanitizeBody(p.problem as string);
        const solution = sanitizeBody(p.proposedSolution as string);
        const brainRegion = p.brainRegion ? sanitizeFreeText(p.brainRegion as string, "brain region") : "N/A";
        const exampleUsage = p.exampleUsage ? sanitizeBody(p.exampleUsage as string) : "";
        const isPlugin = p.isNewPlugin as boolean;
        const pluginName = p.pluginName ? sanitizeFreeText(p.pluginName as string, "plugin name") : "mc-???";

        const prefix = isPlugin ? "[Plugin]" : "[Feature]";
        const featureMatches = findDuplicates(upstreamRepo, "issue", `${prefix} ${title}`, logger);
        if (featureMatches.length > 0) {
          const identity = collectCloneIdentity();
          const commentBody =
            `## Additional request from another clone\n\n` +
            `**Problem:** ${problem}\n\n` +
            `**Proposed solution:** ${solution}\n\n` +
            `**${attribution}**\n\n` +
            `**Clone identity**\n${identity}\n\n` +
            `---\nDuplicate detected by mc-contribute (ref: issue #63)`;
          commentOnExisting(upstreamRepo, "issue", featureMatches[0].number, commentBody, logger);
          return ok(
            `Duplicate feature request detected — commented on existing issue instead.\n\n` +
            `Existing issues matching "${prefix} ${title}":\n${formatDuplicates(featureMatches, "issue")}\n\n` +
            `Your request details were added as a comment on issue #${featureMatches[0].number}.`
          );
        }

        let body: string;
        let label: string;
        let titlePrefix: string;

        if (isPlugin) {
          label = "plugin-idea";
          titlePrefix = "[Plugin]";
          body =
            `**Plugin name**\n${pluginName}\n\n` +
            `**Brain region / cognitive function**\n${brainRegion}\n\n` +
            `**What it does**\n${solution}\n\n` +
            `**Problem it solves**\n${problem}\n\n` +
            (exampleUsage ? `**Example usage**\n\n${exampleUsage}\n\n` : "") +
            `**Attribution**\n${attribution}\n\n` +
            `**Clone identity**\n${collectCloneIdentity()}\n\n` +
            `---\nSubmitted via mc-contribute`;
        } else {
          label = "enhancement";
          titlePrefix = "[Feature]";
          body =
            `**What problem does this solve?**\n${problem}\n\n` +
            `**Proposed solution**\n${solution}\n\n` +
            `**Which plugin/brain region?**\n${brainRegion}\n\n` +
            (exampleUsage ? `**Example usage**\n\n${exampleUsage}\n\n` : "") +
            `**Attribution**\n${attribution}\n\n` +
            `**Clone identity**\n${collectCloneIdentity()}\n\n` +
            `---\nSubmitted via mc-contribute`;
        }

        try {
          const fullTitle = `${titlePrefix} ${title}`;
          const issueUrl = ghWithBodyFile(
            ["issue", "create"],
            body,
            ["--repo", upstreamRepo, "--title", fullTitle, "--label", label],
          );
          logger.info(`Feature request filed: ${issueUrl}`);
          return ok(`Feature request filed: ${issueUrl}`);
        } catch (err: unknown) {
          const e = err as { stderr?: string };
          return ok(`Failed to file feature request: ${e.stderr || "unknown error"}\n\nFile manually at: https://github.com/${upstreamRepo}/issues/new`);
        }
      },
    } as AnyAgentTool,

    // ── Start or reply to a discussion ─────────────────────────────────
    {
      name: "contribute_discussion",
      label: "contribute_discussion",
      description:
        "Start a new GitHub Discussion on the miniclaw-os repo, or list " +
        "recent discussions. Use for architecture ideas, questions, and community talk.",
      parameters: {
        type: "object",
        required: ["action"],
        properties: {
          action: {
            type: "string",
            enum: ["list", "create"],
            description: "'list' to see recent discussions, 'create' to start a new one",
          },
          title: {
            type: "string",
            description: "Discussion title (required for create)",
          },
          body: {
            type: "string",
            description: "Discussion body (required for create)",
          },
          category: {
            type: "string",
            enum: ["Ideas", "Q&A", "Show and tell", "General"],
            description: "Discussion category (default: Ideas)",
          },
        },
      },
      async execute(_id: string, params: unknown) {
        const p = params as Record<string, string>;

        if (p.action === "list") {
          try {
            const discussions = run(
              "gh",
              ["discussion", "list", "--repo", upstreamRepo, "--limit", "10"],
            );
            return ok(`Recent discussions:\n\n${discussions || "(none)"}`);
          } catch {
            return ok(`Visit discussions at: https://github.com/${upstreamRepo}/discussions`);
          }
        }

        if (!p.title || !p.body) {
          return ok("Both title and body are required to create a discussion.");
        }

        const title = sanitizeTitle(p.title);
        const category = p.category || "Ideas";
        const body = `${sanitizeBody(p.body)}\n\n${attribution}\n\n---\nStarted via mc-contribute`;

        try {
          const url = ghWithBodyFile(
            ["discussion", "create"],
            body,
            ["--repo", upstreamRepo, "--title", title, "--category", category],
          );
          return ok(`Discussion created: ${url}`);
        } catch (err: unknown) {
          const e = err as { stderr?: string };
          return ok(
            `Failed to create discussion: ${e.stderr || "unknown error"}\n\n` +
              `Create manually at: https://github.com/${upstreamRepo}/discussions/new`
          );
        }
      },
    } as AnyAgentTool,
  ];
}
