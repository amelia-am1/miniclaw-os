# WORKSPACE.md — Workspace Management Guide

## Why It's Structured This Way

Every session, the agent loads all root `.md` files in `~/.openclaw/workspace/`. That means every line in a root file costs tokens on every single interaction. Keeping root files lean is a direct performance and cost optimization.

Reference files in `refs/` are loaded on demand — only when the agent needs them for a specific task. This keeps the always-loaded context tight and focused.

---

## Layout

```
~/.openclaw/workspace/
├── SOUL.md          # always loaded — core personality
├── IDENTITY.md      # always loaded — name, creature, vibe
├── AGENTS.md        # always loaded — how I operate
├── BOND.md          # always loaded — security bond
├── USER.md          # always loaded — about the human
├── REFERENCES.md    # always loaded — rules + index of refs/
├── MEMORY.md        # vector-indexed — NOT loaded wholesale
├── refs/
│   ├── WORKSPACE.md        # this file — workspace management
│   ├── BOARD_WORKFLOW.md   # kanban verification workflow
│   ├── BOOTSTRAP.md        # first-boot guide (delete after setup)
│   ├── COMMS.md            # communication architecture
│   ├── COMMS_CONFIG.md     # communication setup
│   ├── HEARTBEAT.md        # periodic tasks
│   ├── MEMORY.md           # memory management guidelines
│   ├── READING.md          # reading session tracker
│   ├── REASONING.md        # model-persona relationship
│   ├── TOOLS.md            # local tool reference
│   └── projects/           # custom project docs
└── memory/
    └── YYYY-MM-DD.md       # daily notes
```

---

## The 200 Line Rule

Root files have a **200 line combined maximum**. This is a hard limit.

The six root files (SOUL.md, IDENTITY.md, BOND.md, AGENTS.md, USER.md, REFERENCES.md) are loaded into context on every single session start. At scale, bloated root files mean:
- Slower response times
- Higher token costs
- More noise drowning out signal

**If a root file is growing:** refactor the detailed content into a `refs/` file and leave a one-line pointer in the root file. The agent loads ref files on demand when they're actually needed.

---

## How to Add New Reference Docs

1. Create the file in `refs/` (e.g., `refs/MY_NEW_GUIDE.md`)
2. Add an entry to the table in `REFERENCES.md` with a 1-line summary
3. That's it — the agent will find it via the index and load it when relevant

For project-specific docs, use `refs/projects/` to keep things organized.

---

## How to Keep Things Organized

- **Root files:** Identity, personality, operating procedures, bond. Nothing else.
- **refs/:** Detailed guides, workflows, configuration, tools. Anything the agent doesn't need every session.
- **refs/projects/:** Project-specific documentation.
- **memory/:** Daily notes. Raw, episodic. One file per day.
- **MEMORY.md:** Long-term curated memory. Updated by nightly postmortem. Never read wholesale — use search.

**Rule of thumb:** If you're adding content to a root file and it's getting long, it probably belongs in refs/.
