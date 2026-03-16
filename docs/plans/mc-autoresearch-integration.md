# Plan: mc-autoresearch — Autonomous ML Research Plugin

## Source

[karpathy/autoresearch](https://github.com/karpathy/autoresearch) — AI agents running research on single-GPU nanochat training automatically.

## What it does

An agent modifies a training script (train.py), runs 5-minute experiments, evaluates val_bpb (validation bits per byte), keeps improvements, reverts failures, and repeats. ~12 experiments/hour, ~100 overnight. No human needed.

## Why it fits MiniClaw

MiniClaw agents already:
- Run autonomous work loops (agent-runner, cron workers)
- Track work on a kanban board (mc-board)
- Store knowledge and lessons (mc-kb)
- File issues and PRs (mc-github, mc-contribute)
- Self-repair and iterate

Autoresearch is the same pattern applied to ML: propose → execute → evaluate → learn → repeat. MiniClaw is the orchestration layer that autoresearch is missing.

---

## Integration Plan

### Phase 1: mc-autoresearch plugin (wrapper)

**What:** An OpenClaw plugin that wraps autoresearch's experiment loop and connects it to MiniClaw's brain.

**Plugin structure:**
```
plugins/mc-autoresearch/
├── openclaw.plugin.json
├── package.json
├── index.ts
├── tools/definitions.ts
├── cli/commands.ts
└── src/
    ├── config.ts        # experiment config (GPU, time budget, model)
    ├── runner.ts        # spawns uv run train.py, captures metrics
    ├── tracker.ts       # SQLite experiment log (run_id, val_bpb, changes, duration)
    └── strategy.ts      # reads program.md, decides next experiment
```

**Agent tools:**
- `research_start` — begin an experiment run (or series)
- `research_status` — current experiment progress, metrics
- `research_history` — past experiments with val_bpb trends
- `research_propose` — agent proposes a change to train.py
- `research_evaluate` — compare two runs
- `research_best` — show the best-performing configuration

**CLI commands:**
- `mc autoresearch run` — single 5-min experiment
- `mc autoresearch loop --hours 8` — overnight loop
- `mc autoresearch history` — experiment table
- `mc autoresearch best` — best val_bpb and its train.py

### Phase 2: Board integration

**Each experiment = a card on mc-board.**

The agent creates cards like:
- "Experiment #47: increase n_layer from 6 to 8"
- Acceptance criteria: val_bpb < current best
- Auto-moves to shipped/failed based on result
- Work log contains the diff, metrics, duration

This gives you a visual dashboard of ML research progress.

### Phase 3: Knowledge base integration

**Every experiment result goes to mc-kb.**

```
Type: fact
Title: "n_layer=8 improves val_bpb by 0.3%"
Content: "Experiment #47: changed n_layer from 6 to 8..."
Tags: autoresearch, architecture, nanochat
```

The agent searches mc-kb before proposing changes — "what did we learn about layer count?" — avoiding repeated failures.

### Phase 4: Apple Silicon adaptation

Autoresearch requires NVIDIA. Community forks exist for Apple Silicon:
- [miolini/autoresearch-macos](https://github.com/miolini/autoresearch-macos)
- [trevin-creator/autoresearch-mlx](https://github.com/trevin-creator/autoresearch-mlx)

MiniClaw runs on Macs. The plugin should:
1. Detect hardware (Apple Silicon vs NVIDIA)
2. Use the MLX fork on Apple Silicon
3. Adjust time budget for the hardware (M1 Mini ≠ H100)
4. Scale model size to fit available memory

### Phase 5: Multi-agent research

Multiple MiniClaw agents (clone swarm) running different experiment strategies:
- Agent A: architecture changes (layers, heads, dimensions)
- Agent B: optimizer experiments (learning rate, warmup, schedule)
- Agent C: data experiments (tokenizer, dataset mix)

Results shared via mc-kb. Best findings from any agent become the baseline for all.

---

## What MiniClaw adds that raw autoresearch doesn't

| Autoresearch | MiniClaw + mc-autoresearch |
|---|---|
| Single loop, no memory | Persistent KB of all experiments |
| No visualization | Board cards, timeline, agent runs |
| Manual program.md editing | Agent refines its own strategy based on results |
| Single machine | Clone swarm parallel research |
| Results in git log | Structured experiment DB with search |
| No notifications | Telegram alerts when breakthrough found |
| Stops when you close the terminal | LaunchAgent runs indefinitely |

## Config

```json
{
  "autoresearch": {
    "repoPath": "~/.openclaw/miniclaw/USER/projects/autoresearch",
    "timeBudgetMinutes": 5,
    "maxExperimentsPerSession": 100,
    "hardware": "auto",
    "notifyOnImprovement": true,
    "strategy": "explore-then-exploit"
  }
}
```

## Dependencies

- Python 3.10+ (already installed by install.sh)
- uv package manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- PyTorch (installed by autoresearch's uv sync)
- GPU: Apple Silicon (MLX) or NVIDIA (CUDA)

## Estimated effort

- Phase 1 (wrapper plugin): 1 session
- Phase 2 (board integration): 1 session
- Phase 3 (KB integration): half session
- Phase 4 (Apple Silicon): 1 session (fork adaptation)
- Phase 5 (multi-agent): future

## First step

Clone the Apple Silicon fork, get it running on a Mac Mini, then wrap it in mc-autoresearch.
