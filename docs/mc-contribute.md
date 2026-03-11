# mc-contribute — Community Contribution Toolkit

mc-contribute helps agents and their humans contribute to the MiniClaw-OS repo. It scaffolds new plugins, creates branches, runs security checks, submits PRs, files bug reports, and manages GitHub Discussions.

---

## Overview

The plugin injects a short contribution context into every prompt (via `before_prompt_build`) so the agent always knows the key rules when working in the miniclaw-os repo. Full guidelines are available on demand via the `contribute_guidelines` tool.

All git and GitHub operations use `gh` CLI and standard git commands under the hood.

---

## CLI Commands

All commands use `openclaw mc-contribute <subcommand>`.

### `scaffold <name>`
Scaffold a new plugin with the correct directory structure.

```
openclaw mc-contribute scaffold weather --description "Weather forecasts" --region utility
```

Creates `plugins/mc-<name>/` with `openclaw.plugin.json`, `package.json`, `index.ts`, `tools/definitions.ts`, `cli/commands.ts`, and `docs/README.md`.

### `branch <topic>`
Create a contribution branch following the `contrib/<topic>` naming convention.

```
openclaw mc-contribute branch mc-weather
```

### `security`
Run the security scanner on the repo.

```
openclaw mc-contribute security [--all]
```

Scans for hardcoded secrets, API keys, tokens, and PII. Default: staged files only. `--all`: full repo.

### `pr`
Submit a pull request to miniclaw-os.

```
openclaw mc-contribute pr
```

### `status`
Check contribution status — current branch, uncommitted changes, open PRs.

```
openclaw mc-contribute status
```

---

## Agent Tools

| Tool | Description |
|------|-------------|
| `contribute_scaffold_plugin` | Scaffold a new plugin with the full directory structure. Parameters: `pluginName`, `description`, `brainRegion` (all required). |
| `contribute_branch` | Create a `contrib/<topic>` branch from main. Parameter: `topic` (required). |
| `contribute_security_check` | Run the security scanner. Parameter: `scope` (optional: "staged" or "all"). |
| `contribute_pr` | Push branch and create a PR to upstream. Runs security check first. Parameters: `title`, `summary` (required); `pluginsAffected` (optional). |
| `contribute_status` | Show current branch, uncommitted changes, recent commits, and open PRs. |
| `contribute_guidelines` | Return the full MiniClaw contribution guidelines. Read this before making any contribution. |
| `contribute_bug_report` | File a bug report issue. Auto-collects environment info (macOS, Node, mc version) and mc-doctor output. Parameters: `title`, `whatHappened`, `expected`, `stepsToReproduce` (required); `pluginsInvolved` (optional). |
| `contribute_feature_request` | Submit a feature request or plugin idea. Parameters: `title`, `problem`, `proposedSolution` (required); `brainRegion`, `isNewPlugin`, `pluginName`, `exampleUsage` (optional). |
| `contribute_discussion` | List or create GitHub Discussions. Parameters: `action` (required: "list" or "create"); `title`, `body`, `category` (for create). |

---

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `upstreamRepo` | string | `augmentedmike/miniclaw-os` | GitHub repo for PRs and issues |
| `forkRemote` | string | `origin` | Git remote name for pushing branches |

---

## Contribution Guidelines Summary

- One plugin, one job. No combined unrelated functionality.
- TypeScript for all plugin code. Tools return `{ content: [{ type: "text", text }], details: {} }`.
- Use the vault for secrets. Never hardcode tokens, keys, or passwords.
- The pre-commit hook (`scripts/security-check.sh`) blocks commits with secrets.
- Branch naming: `contrib/<plugin-name>`, `contrib/fix-<description>`, `contrib/docs-<topic>`.
- PR titles under 70 characters. Include summary bullets and affected plugins.
