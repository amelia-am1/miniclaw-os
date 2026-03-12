import type { Command } from "commander";
import type { ContributeConfig } from "../src/config.js";
import { CONTRIBUTION_GUIDELINES } from "../src/guidelines.js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

type Logger = { info(m: string): void; warn(m: string): void; error(m: string): void };

function run(cmd: string, cwd?: string): string {
  return execSync(cmd, { encoding: "utf-8", cwd, timeout: 30_000 }).trim();
}

export function registerContributeCommands(
  ctx: { program: Command; logger: Logger },
  cfg: ContributeConfig
): void {
  const { program, logger } = ctx;

  const cmd = program
    .command("mc-contribute")
    .description("Contribute to MiniClaw — scaffold plugins, submit PRs, report bugs");

  cmd
    .command("scaffold <name>")
    .description("Scaffold a new plugin (e.g. scaffold weather → mc-weather)")
    .requiredOption("-d, --description <desc>", "Plugin description")
    .option("-r, --region <region>", "Brain region category", "utility")
    .action(async (name: string, opts: { description: string; region: string }) => {
      const pluginName = name.replace(/^mc-/, "");
      const fullName = `mc-${pluginName}`;
      const repoRoot = run("git rev-parse --show-toplevel");
      const pluginDir = path.join(repoRoot, "plugins", fullName);

      if (fs.existsSync(pluginDir)) {
        console.log(`Plugin ${fullName} already exists at ${pluginDir}`);
        return;
      }

      for (const sub of ["src", "tools", "cli", "docs"]) {
        fs.mkdirSync(path.join(pluginDir, sub), { recursive: true });
      }

      const cap = pluginName.charAt(0).toUpperCase() + pluginName.slice(1);

      fs.writeFileSync(
        path.join(pluginDir, "openclaw.plugin.json"),
        JSON.stringify({
          id: fullName, name: `MiniClaw ${cap}`, description: opts.description,
          version: "0.1.0",
          configSchema: { type: "object", additionalProperties: false, properties: {} },
        }, null, 2)
      );

      fs.writeFileSync(
        path.join(pluginDir, "package.json"),
        JSON.stringify({
          name: fullName, version: "0.1.0", description: opts.description,
          type: "module", main: "index.ts",
        }, null, 2)
      );

      fs.writeFileSync(path.join(pluginDir, "index.ts"),
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
`);

      fs.writeFileSync(path.join(pluginDir, "tools", "definitions.ts"),
`import type { AnyAgentTool } from "openclaw/plugin-sdk";

type Logger = { info(m: string): void; warn(m: string): void; error(m: string): void };

export function create${cap}Tools(logger: Logger): AnyAgentTool[] {
  return [
    // TODO: Add your tools here
  ];
}
`);

      fs.writeFileSync(path.join(pluginDir, "cli", "commands.ts"),
`import type { Command } from "commander";

type Logger = { info(m: string): void; warn(m: string): void; error(m: string): void };

export function register${cap}Commands(
  ctx: { program: Command; logger: Logger }
): void {
  const { program } = ctx;

  program
    .command("${fullName}")
    .description("${opts.description}");

  // TODO: Add subcommands here
}
`);

      fs.writeFileSync(path.join(pluginDir, "docs", "README.md"),
        `# ${fullName}\n\n**Brain region:** ${opts.region}\n\n${opts.description}\n`
      );

      logger.info(`Scaffolded ${fullName} at ${pluginDir}`);
      console.log(`Scaffolded ${fullName} at plugins/${fullName}/`);
      console.log(`\nFiles created:`);
      for (const f of ["openclaw.plugin.json", "package.json", "index.ts", "tools/definitions.ts", "cli/commands.ts", "docs/README.md"]) {
        console.log(`  ${fullName}/${f}`);
      }
      console.log(`\nNext steps:`);
      console.log(`  1. Add tools in tools/definitions.ts`);
      console.log(`  2. Add CLI commands in cli/commands.ts`);
      console.log(`  3. Add config properties in openclaw.plugin.json`);
      console.log(`  4. Test with: mc plugin test ${fullName}`);
    });

  cmd
    .command("branch <topic>")
    .description("Create a contribution branch (e.g. branch mc-weather)")
    .action(async (topic: string) => {
      const slug = topic.replace(/\s+/g, "-").toLowerCase();
      const branch = `contrib/${slug}`;
      const repoRoot = run("git rev-parse --show-toplevel");

      run("git checkout main", repoRoot);
      try { run("git pull --ff-only", repoRoot); } catch {}
      run(`git checkout -b ${branch}`, repoRoot);

      logger.info(`Created branch ${branch}`);
      console.log(`Created branch: ${branch}`);
      console.log(`Make your changes, then use 'mc mc-contribute pr' to submit.`);
    });

  cmd
    .command("security")
    .description("Run security scan on the repo")
    .option("-a, --all", "Scan full repo (default: staged files only)")
    .action(async (opts: { all?: boolean }) => {
      const repoRoot = run("git rev-parse --show-toplevel");
      const script = path.join(repoRoot, "scripts", "security-check.sh");
      const flag = opts.all ? "--all" : "";

      try {
        const output = run(`bash ${script} ${flag}`, repoRoot);
        console.log(output);
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string };
        console.error(`SECURITY ISSUES FOUND:\n\n${e.stdout || ""}\n${e.stderr || ""}`);
        console.error(`\nFix these before committing.`);
        process.exit(1);
      }
    });

  cmd
    .command("pr")
    .description("Submit a pull request to miniclaw-os")
    .requiredOption("-t, --title <title>", "PR title (short, under 70 chars)")
    .requiredOption("-s, --summary <summary>", "What this PR does (1-3 bullet points)")
    .option("-p, --plugins <plugins>", "Comma-separated list of affected plugins")
    .action(async (opts: { title: string; summary: string; plugins?: string }) => {
      const repoRoot = run("git rev-parse --show-toplevel");

      // Security check first
      const script = path.join(repoRoot, "scripts", "security-check.sh");
      try {
        run(`bash ${script} --all`, repoRoot);
      } catch (err: unknown) {
        const e = err as { stdout?: string };
        console.error(`PR blocked — security issues found:\n\n${e.stdout || ""}`);
        console.error(`Fix these first, then try again.`);
        process.exit(1);
      }

      // Push branch
      const branch = run("git branch --show-current", repoRoot);
      try {
        run(`git push -u ${cfg.forkRemote} ${branch}`, repoRoot);
      } catch {
        console.error(`Failed to push branch ${branch}. Make sure your fork remote is set up.`);
        process.exit(1);
      }

      // Create PR
      const plugins = opts.plugins || "N/A";
      const body =
        `## Summary\n\n${opts.summary}\n\n` +
        `## Plugin(s) affected\n\n${plugins}\n\n` +
        `## Security check\n\n- [x] Ran \`./scripts/security-check.sh\` (passed)\n- [x] No secrets, tokens, or PII in this PR\n\n` +
        `---\nSubmitted via mc-contribute`;

      try {
        const prUrl = run(
          `gh pr create --repo ${cfg.upstreamRepo} --title "${opts.title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}"`,
          repoRoot
        );
        console.log(`PR created: ${prUrl}`);
      } catch (err: unknown) {
        const e = err as { stderr?: string };
        console.error(`Failed to create PR: ${e.stderr || "unknown error"}`);
        process.exit(1);
      }
    });

  cmd
    .command("status")
    .description("Check contribution status — branch, changes, open PRs")
    .action(async () => {
      const repoRoot = run("git rev-parse --show-toplevel");
      const branch = run("git branch --show-current", repoRoot);
      const status = run("git status --short", repoRoot);
      const log = run("git log --oneline -5", repoRoot);

      let prs = "none";
      try {
        prs = run(`gh pr list --repo ${cfg.upstreamRepo} --author @me --state open`, repoRoot);
        if (!prs) prs = "none";
      } catch {
        prs = "(could not check — gh auth may be needed)";
      }

      console.log(`Branch: ${branch}\n`);
      console.log(`Uncommitted changes:\n${status || "(clean)"}\n`);
      console.log(`Recent commits:\n${log}\n`);
      console.log(`Open PRs:\n${prs}`);
    });

  cmd
    .command("guidelines")
    .description("Print the full MiniClaw contribution guidelines")
    .action(async () => {
      console.log(CONTRIBUTION_GUIDELINES);
    });
}
