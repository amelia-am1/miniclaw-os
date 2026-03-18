# mc-contribute

**Brain region:** utility — the immune system's self-repair loop

mc-contribute is the contribution toolkit for the MiniClaw plugin ecosystem. It lets agents (and their humans) scaffold new plugins, file bug reports, submit feature requests, create PRs, and manage GitHub Discussions — all from the CLI or as agent tools.

## Why it matters

MiniClaw agents are autohealing software. When an agent hits a bug, it can use mc-contribute to file the issue with auto-collected diagnostics (mc-doctor output, macOS version, Node version). When it builds a new tool for itself, it can scaffold a proper plugin and submit a PR upstream. The issue and PR activity on this repo is largely agents self-reporting problems and contributing fixes.

## How it works

- **Context injection:** Every prompt in the miniclaw-os repo gets contribution rules prepended automatically via `before_prompt_build`. The agent always knows the rules without being told.
- **Pre-flight checks:** `contribute_pr` enforces a mandatory checklist before any PR can be submitted: test files in diff, tests passing, docs updated, security clean.
- **Attribution (automatic):** Every issue and PR is tagged with the agent's name and GitHub username. Resolved automatically from IDENTITY.md, agent.json, or `gh auth` — no manual setup required.
- **Issue gating:** Bug reports, feature requests, and plugin ideas are gated — agents must be on a contribution branch with code before filing any issue.
- **CLI commands:** `mc mc-contribute <subcommand>` for human use.
- **Agent tools:** 9 tools for autonomous contribution workflows.
- **Security-first:** All PRs run the security scanner before submission. Commits with secrets are blocked.

## CLI Commands

| Command | Description |
|---------|-------------|
| `scaffold <name>` | Scaffold a new plugin with correct structure (now includes test stubs) |
| `branch <topic>` | Create a `contrib/<topic>` branch from main |
| `security [--all]` | Run security scanner (staged files or full repo) |
| `pr -t <title> -s <summary>` | Push branch and create PR (pre-flight checks first) |
| `preflight` | Run the pre-flight checklist without submitting |
| `bug <title>` | File a bug report (gated: must be on contrib branch) |
| `feature <title>` | Submit feature request (gated: must be on contrib branch) |
| `status` | Show branch, uncommitted changes, open PRs, attribution |
| `guidelines` | Print the full contribution guidelines |

## Agent Tools

| Tool | Description |
|------|-------------|
| `contribute_scaffold_plugin` | Scaffold a new plugin directory (with test stubs) |
| `contribute_branch` | Create a contribution branch |
| `contribute_security_check` | Run the security scanner |
| `contribute_pr` | Push and create a PR (with pre-flight and attribution) |
| `contribute_status` | Check contribution status |
| `contribute_guidelines` | Get full contribution guidelines |
| `contribute_bug_report` | File a bug report (GATED: must be on contrib branch) |
| `contribute_feature_request` | Submit a feature request (GATED: must be on contrib branch) |
| `contribute_discussion` | List or create GitHub Discussions |

## Pre-flight Checklist (enforced by contribute_pr)

Before any PR can be submitted, ALL of these must pass:
1. Test files added or updated in the diff
2. All plugin tests passing (`npx vitest run`)
3. README/docs updated if new commands or tools were added
4. Security check clean (`./scripts/security-check.sh --all`)

## Agent Coordination (ref: GitHub issue #63)

mc-contribute enforces agent coordination to prevent multiple clones from colliding on the same issues:

- **Duplicate detection:** Before creating any issue or PR, the plugin searches for existing open items with similar titles using `gh issue list --search` / `gh pr list --search`.
- **Comment instead of duplicate:** If a match is found, mc-contribute automatically comments on the existing issue/PR with the agent's details instead of creating a new one.
- **Clone identity:** Every issue, PR, and comment includes the agent's clone identity (hostname, bot ID, state dir) for traceability.
- **Tools affected:** `contribute_pr`, `contribute_bug_report`, `contribute_feature_request` all perform duplicate checks before creation.

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `upstreamRepo` | `augmentedmike/miniclaw-os` | GitHub repo for PRs and issues |
| `forkRemote` | `origin` | Git remote for pushing branches |
| `agentName` | *(auto-resolved)* | Agent name for attribution (from IDENTITY.md / agent.json / hostname) |
| `ghUsername` | *(auto-resolved)* | GitHub username (from `gh auth`) |

## Full documentation

See [docs/mc-contribute.md](../../docs/mc-contribute.md).

## For Reviewers

If you're reviewing an incoming PR (not submitting one), see [REVIEWING.md](../../REVIEWING.md) in the repo root. It has a structured checklist covering security audit, code quality, test coverage, CI, philosophical alignment, and trust verification.
