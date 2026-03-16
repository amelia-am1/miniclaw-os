# Self-Healing Software: How MiniClaw Maintains Itself

## The Core Idea

MiniClaw is software that writes, tests, reviews, and deploys its own code -- autonomously, around the clock, without waiting for a human to press "go." At the center of this is a kanban board that isn't just a tracker: it's the system's prefrontal cortex. Work items flow through a strict state machine, and cron-driven agent workers pick up tasks, execute them, verify the results, and ship them -- or fail them back for another pass.

The result is a development lifecycle that runs itself. Bugs get triaged. Features get built. Code gets reviewed and deployed. The system heals its own defects, extends its own capabilities, and maintains quality gates that prevent broken code from ever reaching production.

---

## The Brain Board: A State Machine, Not a Spreadsheet

MiniClaw's kanban board (`mc-board`) is backed by a SQLite database with a formally defined state machine. Every card (task) follows a single, irreversible path:

```
backlog --> in-progress --> in-review --> shipped
```

There is no skipping. There is no going backward (except one system-triggered exception: a failed review sends a card back to in-progress for rework). Each transition is gated:

- **Backlog to In-Progress:** Requires a problem description, implementation plan, and acceptance criteria. No vague "fix the thing" cards. The system forces specificity before work begins.
- **In-Progress to In-Review:** Every acceptance criteria checkbox must be checked off. The work must demonstrably meet its own definition of done.
- **In-Review to Shipped:** A review/audit pass must be completed and documented. No card ships without a critic's sign-off.

If a gate fails, the system returns a structured error telling the worker exactly which fields to fill and how. The feedback loop is immediate and unambiguous.

---

## The Cron Workers: Three Autonomous Agents, Running Every Five Minutes

Three cron workers operate on staggered five-minute intervals, each responsible for one phase of the development lifecycle:

### 1. Backlog Worker (board-worker-backlog)

Runs at `*/5 * * * *`. Surveys the backlog, respects a capacity gate (max 6 cards in-progress at once), and selects the highest-priority candidates grouped by project. For each selected card, it:

- Picks up the card (registering itself as the active worker)
- Fills in any missing fields: problem description, implementation plan, acceptance criteria
- Moves the card to in-progress
- Releases the card

Focus-tagged cards bypass the capacity gate entirely -- they get promoted immediately, ensuring urgent work is never blocked by queue depth.

### 2. In-Progress Worker (board-worker-in-progress)

Runs at `1-59/5 * * * *` (one minute offset). Surveys all in-progress cards, selects the best candidate per project, and performs one unit of work. This is where the system actually writes code, modifies files, runs tests, and checks off acceptance criteria. When all criteria are met, the card advances to in-review.

### 3. In-Review Worker (board-worker-in-review)

Runs at `2-59/5 * * * *` (two minute offset). Surveys cards in review, runs verification and deployment steps, and either ships the card or fails it back to in-progress with notes on what went wrong. A failed review is not a dead end -- it re-enters the work cycle and the in-progress worker picks it up on the next pass.

This creates a continuous three-phase pipeline: triage, execute, verify. Every five minutes, all three phases advance simultaneously across different cards.

---

## The Pickup/Release Protocol: No Duplicate Work

MiniClaw solves the coordination problem with a pickup/release protocol backed by an `active_work` table. Before any worker touches a card, it calls `brain_pickup` to register itself. Before picking up a card, it calls `brain_active` to see what's already being worked. If another worker has the card, it skips it.

Every pickup and release is logged to a `pickup_log` table with timestamps, worker names, and card IDs. This creates a full audit trail of which agent loop processed which ticket and when -- visible through the `brain_pickup_log` tool and the web dashboard.

The protocol prevents race conditions between the three cron workers and any interactive sessions. A human or agent working on a card through the CLI can pick it up and hold it, and the cron workers will route around it.

---

## Self-Modifying Code: The System Writes Its Own Plugins

MiniClaw's plugin architecture is designed for self-extension. The `mc-contribute` plugin can scaffold entirely new plugins from scratch -- creating the directory structure, configuration files, TypeScript entry points, tool definitions, CLI commands, and documentation. The system doesn't just manage tasks about code; it has the tools to write that code directly.

The `mc-jobs` plugin provides role-specific workflow templates (like "Software Developer") with review gates that define what "done" means: code runs locally, tests pass, working directory is clean, commit messages are clear. These gates are enforced programmatically, not by hope.

When the in-progress worker picks up a card tagged for a plugin fix or feature, it has access to the full filesystem, git, package managers, and test runners. It writes the code, runs the tests, checks off the criteria, and submits it for review. The in-review worker then audits the changes before shipping.

---

## Diagnostics and Auto-Repair

Beyond the development lifecycle, MiniClaw includes infrastructure-level self-healing:

- **mc-doctor** diagnoses and auto-repairs broken installations: missing dependencies, uninitialized vaults, absent directories, broken encrypt/decrypt cycles, missing plugin dependencies. Run with `--auto` and it fixes everything it can without prompting.
- **mc-smoke** performs quick health checks to verify all components are running.
- **mc-backup** runs daily tgz backups with tiered retention (daily, monthly, yearly), ensuring the system can recover from catastrophic state loss.

The integrity check built into the backlog worker (`check-dupes --fix`) runs on every triage cycle, deduplicating and repairing the board state before any work selection happens.

---

## What This Means

Traditional software waits for humans to notice problems, write tickets, prioritize work, assign developers, review PRs, and deploy releases. MiniClaw compresses that entire pipeline into an autonomous loop:

1. Work enters the backlog (from the agent itself, from a human, or from another system).
2. The backlog worker triages, plans, and promotes it.
3. The in-progress worker executes the work -- writing real code, running real tests.
4. The in-review worker audits and ships (or rejects and recycles).
5. The cycle repeats every five minutes.

The system doesn't just track its own maintenance -- it performs it. It doesn't just record what needs fixing -- it fixes it. And every transition is gated, logged, and auditable.

This is not a CI/CD pipeline that runs when you push a commit. This is a system that decides what to build, builds it, checks its own work, and deploys it -- continuously, without human intervention, with quality gates that prevent bad code from shipping.

MiniClaw maintains itself.
