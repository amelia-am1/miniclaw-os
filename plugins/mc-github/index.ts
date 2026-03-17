import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { registerGithubCommands } from "./cli/commands.js";
import { createGithubTools } from "./tools/definitions.js";
import fs from "node:fs";
import path from "node:path";

interface GithubConfig {
  defaultRepo?: string;
}

function loadCodingAxioms(): string {
  // Walk up from cwd looking for CODING_AXIOMS.md
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, "CODING_AXIOMS.md");
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, "utf-8");
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return "";
}

export default function register(api: OpenClawPluginApi): void {
  const cfg = (api.pluginConfig ?? {}) as GithubConfig;

  api.logger.info(`mc-github loaded${cfg.defaultRepo ? ` (repo: ${cfg.defaultRepo})` : ""}`);

  // Inject GitHub workflow context into every prompt.
  // This is the general-purpose workflow — not project-specific like mc-contribute.
  if (typeof api.hook === "function") api.hook("before_prompt_build", (_ctx) => {
    const axioms = loadCodingAxioms();
    const axiomsSection = axioms
      ? `\n## Coding Axioms (from repo)\n${axioms}\n`
      : "";

    return {
      prepend:
        `## GitHub Workflow Context\n` +
        `You have mc-github tools available for working with any GitHub repository.\n` +
        `Follow the issue-driven workflow:\n` +
        `1. Every change starts with a GitHub issue — use github_issue_create\n` +
        `2. Branch from the issue: fix/N-slug, feat/N-slug, chore/N-slug\n` +
        `3. Commits reference the issue number\n` +
        `4. Create PRs with github_pr_create — use "Fixes #N" to auto-close issues\n` +
        `5. Check CI status with github_actions_status before merging\n` +
        `6. Close issues with resolution comments documenting what changed\n` +
        axiomsSection,
    };
  });

  api.registerCli((ctx) => {
    registerGithubCommands({ program: ctx.program, logger: api.logger }, cfg);
  });

  for (const tool of createGithubTools(cfg, api.logger)) {
    api.registerTool(tool);
  }
}
