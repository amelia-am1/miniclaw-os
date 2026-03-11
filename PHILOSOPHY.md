# MiniClaw Philosophy

Why we build tools instead of automating UIs.

---

## The Core Idea

An AI agent that can write and call CLI tools is more capable than one that
tries to click buttons in a GUI.

Browser automation is brittle. Screen coordinates shift. Modals appear.
Authentication flows change. CSS selectors break between releases. The agent
spends more tokens navigating chrome than doing actual work. And when it
fails, the failure mode is "I clicked the wrong thing" — unrecoverable,
unreplayable, unexplainable.

CLI tools are the opposite. They're deterministic. They compose. They have
`--help`. They return exit codes. They can be tested, versioned, and piped.
An agent that builds a CLI tool today can call it a thousand times tomorrow
without re-learning anything.

**MiniClaw gives the agent tools to make tools.**

---

## CLI-First, Not UI-Avoidant

We don't avoid browsers — we use them differently.

When the agent needs something from a web service that has no API, it doesn't
try to puppet the browser through 47 clicks. Instead:

1. The human logs in (humans are good at this)
2. The agent watches via Chrome DevTools Protocol
3. The agent studies the network requests, auth patterns, and data shapes
4. The agent builds a CLI tool that talks directly to the service
5. That tool goes into `USER/bin/` — the agent's own toolbox

The browser was used once, for reconnaissance. The tool it produced works
forever. Next time the agent needs that service, it calls its own tool. No
pixels, no coordinates, no "click the blue button."

This is how a competent engineer works. You don't use Photoshop through the
GUI every time you need to resize an image — you write an ImageMagick
one-liner and alias it. MiniClaw agents think the same way.

---

## mc-designer: What This Looks Like in Practice

Photoshop is a 4GB application with thousands of menu items, floating
palettes, and modal dialogs. Getting an AI to use Photoshop via screen
automation is a research project. Getting it to produce good images is a
different, simpler problem.

mc-designer is MiniClaw's answer. It's a CLI-based compositing system with:

- **Layer stacks** — base image, overlay, text, adjustment layers
- **Filters and adjustments** — the same operations Photoshop offers
  (levels, curves, color balance, blur, sharpen) but as CLI flags
- **Gemini-backed generation** — describe what you want, get pixels back
- **Chroma keying, alpha compositing, canvas management** — all via
  `mc mc-designer <subcommand>`

The agent doesn't need to find the Layers palette or remember that
Ctrl+Shift+Alt+E flattens visible. It runs:

```bash
mc mc-designer gen --prompt "watercolor portrait, warm light" --width 1024
mc mc-designer alpha chroma-key --input face.png --color green
mc mc-designer composite --base background.png --overlay face.png --blend multiply
```

Deterministic. Composable. Testable. The agent can build complex multi-layer
images in a loop, checking results at each step, without ever rendering a
pixel on screen.

---

## The SYSTEM/USER Split

This philosophy extends to how we organize the agent's world:

- **`miniclaw/SYSTEM/`** — tools we ship. The agent's standard library.
  Read-only from the agent's perspective. `mc-vault`, `mc`, `mc-smoke`, etc.

- **`USER/bin/`** — tools the agent builds for itself. Its personal toolkit.
  The agent writes CLI commands here when it encounters a problem it'll face
  again. These are first-class executables, not prompt hacks.

The agent starts with SYSTEM tools and grows its own USER tools over time.
A fresh install has an empty `USER/bin/`. A mature agent has dozens of
specialized tools it built to solve problems specific to its operator's
workflow.

---

## Why Not Computer Use?

Computer-use agents (screen → click → screen → click) solve the demo
problem: they look impressive in a video. But they fail on the deployment
problem:

| | Computer Use | CLI Tools |
|---|---|---|
| **Latency** | Screenshot → vision model → coordinate → click → wait → screenshot | exec → stdout → done |
| **Reliability** | Breaks on UI changes, popups, resolution differences | Deterministic given same inputs |
| **Cost** | Vision tokens per frame, multiple rounds per action | One tool call, text tokens only |
| **Composability** | Each action is isolated | Pipe, chain, parallelize |
| **Debuggability** | "Why did it click there?" | Read the script, check the exit code |
| **Reusability** | Re-navigate every time | Call the tool forever |
| **Offline** | Needs the running application | Needs nothing but the binary |

Computer use has a place — initial exploration of a new service, one-off
tasks where building a tool isn't worth it, situations where no API or
network protocol exists. MiniClaw supports it via mc-human (noVNC-based
human intervention) and Chrome DevTools integration.

But the design goal is always: **use the browser to learn, then build a tool
so you never need the browser again.**

---

## Principles

1. **Tools over automation.** Build a CLI, not a macro.
2. **Observe, then codify.** Watch the browser once, call the API forever.
3. **The agent's toolbox grows.** Every solved problem becomes a reusable tool.
4. **Deterministic beats probabilistic.** A tool that works is better than a
   vision model that usually works.
5. **Composability is power.** Small tools that pipe together beat monolithic
   automation scripts.
6. **The human does what humans do best.** Log in, approve, make judgment
   calls. The agent does the rest.
7. **SYSTEM ships the foundation. USER builds the house.** We give the agent
   a toolkit. It builds its own.
