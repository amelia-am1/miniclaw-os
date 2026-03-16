# Plan: mc-research — Autonomous Research Agent

## Source

[karpathy/autoresearch](https://github.com/karpathy/autoresearch) — The pattern, not the ML specifics. Andrej's insight: give an agent a hypothesis, a fixed-time experiment, a metric, and let it iterate autonomously. Works for any research, not just ML.

## The Pattern

```
propose hypothesis → design experiment → execute (fixed time) → measure → learn → repeat
```

This is the scientific method on autopilot. The agent runs 100 experiments overnight. You wake up to findings.

---

## What MiniClaw already has

| Capability | Plugin |
|---|---|
| Task tracking | mc-board (cards as experiments) |
| Long-term memory | mc-kb (store findings, avoid repeats) |
| Web research | mc-seo, browser automation |
| Email outreach | mc-email |
| Contact management | mc-rolodex |
| Content creation | mc-blog, mc-designer, mc-substack |
| Scheduling | mc-booking |
| Payments | mc-stripe, mc-square |
| Code execution | agent-runner (spawns claude) |
| Cron scheduling | mc-jobs (run experiments on schedule) |

MiniClaw is already a research platform. It just doesn't think of itself as one.

---

## mc-research plugin

### Core concept

A research project is:
1. **A question** — "What email subject lines get the best open rates?"
2. **A method** — "Send 10 variations to segments of 50, measure opens after 24h"
3. **A metric** — open rate (%)
4. **A time budget** — 24h per experiment batch
5. **A knowledge base** — all past experiments and their results

The agent proposes experiments, executes them using existing mc-* plugins, measures results, stores findings in mc-kb, and proposes the next experiment.

### Plugin structure

```
plugins/mc-research/
├── openclaw.plugin.json
├── package.json
├── index.ts
├── tools/definitions.ts
├── cli/commands.ts
└── src/
    ├── config.ts         # research project config
    ├── project.ts        # project CRUD (SQLite)
    ├── experiment.ts     # experiment lifecycle
    └── analysis.ts       # compare results, find patterns
```

### Agent tools

- `research_create_project` — define a research question, method, metric
- `research_propose` — agent proposes next experiment based on findings
- `research_execute` — run the experiment (delegates to mc-email, mc-seo, etc.)
- `research_record` — log results with metric value
- `research_analyze` — compare experiments, find what works
- `research_report` — generate a findings report
- `research_history` — all experiments for a project

### Research types and how they map to mc-* plugins

**Market research**
- Method: web scraping, competitor monitoring
- Tools: browser automation, mc-seo crawl
- Metric: market share %, pricing delta, feature gap count

**Email optimization**
- Method: A/B test subject lines, send times, content
- Tools: mc-email (send variants), measure open/reply rates
- Metric: open rate %, reply rate %, conversion rate %

**SEO experiments**
- Method: change page titles, meta descriptions, content structure
- Tools: mc-seo (crawl, rank check), mc-blog (publish variants)
- Metric: search rank position, click-through rate

**Content strategy**
- Method: publish different formats, topics, styles
- Tools: mc-blog, mc-substack, mc-social (X, Reddit)
- Metric: views, engagement, shares, subscriber growth

**Customer discovery**
- Method: outreach to potential customers, track responses
- Tools: mc-email, mc-rolodex, mc-booking
- Metric: response rate %, meeting book rate %, deal close rate

**Pricing research**
- Method: test different price points, offers, bundles
- Tools: mc-stripe, mc-square, mc-booking
- Metric: conversion rate %, revenue per visitor

**Academic/literature research**
- Method: search papers, extract findings, synthesize
- Tools: browser automation, mc-kb (store citations)
- Metric: papers reviewed, key findings extracted, gaps identified

**Prompt engineering**
- Method: vary system prompts, measure task completion
- Tools: agent-runner, mc-board (track card success rate)
- Metric: task success rate %, tokens used, time to completion

**Self-optimization**
- Method: tune plugin configs, cron schedules, context windows
- Tools: all mc-* plugins
- Metric: agent efficiency (tokens/task, success rate, human escalations)

---

## How it works end-to-end

### Example: Email subject line optimization

1. Human creates project: "Optimize cold outreach email subject lines"
2. Agent reads mc-kb for past email experiments
3. Agent proposes 5 subject line variants
4. Agent sends each variant to 20 contacts via mc-email (tracked in mc-rolodex)
5. Agent waits 24h (cron job)
6. Agent checks open rates via mc-email inbox analysis
7. Agent records results: "Variant C: 45% open rate, Variant A: 12%"
8. Agent stores finding in mc-kb: "Subject lines with numbers outperform generic ones by 3x"
9. Agent proposes next batch based on winning variant
10. Repeat

All visible on mc-board. Each batch = a card. Timeline shows progress. Human reviews findings via Telegram.

### Example: Competitive intelligence

1. Human: "Track what our top 3 competitors are doing"
2. Agent crawls competitor websites weekly (mc-seo)
3. Agent compares pricing, features, content changes
4. Agent stores diffs in mc-kb
5. Agent generates weekly report via mc-docs
6. Agent sends summary via Telegram
7. When significant change detected: alert immediately

---

## Board integration

Each research project = a mc-board project.
Each experiment = a card.

Card lifecycle:
- **backlog** — proposed experiment
- **in-progress** — experiment running
- **in-review** — results measured, awaiting analysis
- **shipped** — findings recorded in mc-kb

The board becomes a research dashboard.

---

## Config

```json
{
  "mc-research": {
    "maxConcurrentProjects": 3,
    "defaultTimeBudget": "24h",
    "autoPropose": true,
    "notifyOnFinding": true,
    "minExperimentsBeforeReport": 5
  }
}
```

---

## What autoresearch taught us

1. **Fixed time budget** — every experiment runs for the same duration. Apples to apples.
2. **Single metric** — one number to optimize. No ambiguity.
3. **Agent freedom within constraints** — the agent chooses what to try, but the experiment framework is fixed.
4. **program.md** — human writes the research strategy, agent executes it. Human refines strategy based on results.
5. **Persistence** — every experiment is logged. The agent never forgets what it tried.

MiniClaw already has all of this. mc-research just formalizes the pattern.

---

## Estimated effort

- Phase 1: Core plugin (project CRUD, experiment lifecycle, tools) — 1 session
- Phase 2: Board integration (cards as experiments) — 1 session
- Phase 3: KB integration (findings storage and search) — half session
- Phase 4: Example research templates (email, SEO, pricing) — 1 session
- Phase 5: Cron-driven autonomous loop — already built (agent-runner)

## First step

Build the plugin with one research type (email subject line optimization) as the proof of concept. The rest are just different tools called from the same experiment loop.
