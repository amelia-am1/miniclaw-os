/**
 * mc-reflection — OpenClaw plugin
 *
 * Nightly self-reflection engine. Gathers the day's context from:
 * - Episodic memory (daily markdown files)
 * - Brain board (card state, shipped today, work logs)
 * - Knowledge base (entries created/updated today)
 * - Session transcripts (what was discussed)
 *
 * Then the agent reasons about the day and produces:
 * - Board cards (todos, corrections, future protection)
 * - KB entries (lessons, postmortems, decisions)
 * - A reflection snapshot (stored in SQLite + markdown)
 *
 * Reflection dir: ~/.openclaw/USER/<bot_id>/reflections
 */

import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

function _resolveBotId(): string {
  if (process.env.OPENCLAW_BOT_ID) return process.env.OPENCLAW_BOT_ID;
  const stateDir = process.env.OPENCLAW_STATE_DIR ?? path.join(os.homedir(), ".openclaw");
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(stateDir, "openclaw.json"), "utf-8"));
    if (cfg.botId) return cfg.botId as string;
  } catch {}
  throw new Error("OPENCLAW_BOT_ID not set and botId not found in openclaw.json — run the setup wizard");
}
import { registerReflectionCommands } from "./cli/commands.js";
import { createReflectionTools, type ReflectionToolsConfig } from "./tools/definitions.js";
import type { GatherConfig } from "./src/gather.js";

interface ReflectionPluginConfig {
  reflectionDir: string;
  memoryDir: string;
  boardDbPath: string;
  kbDbPath: string;
  transcriptsDir: string;
}

function resolvePath(p: string): string {
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function resolveConfig(api: OpenClawPluginApi): ReflectionPluginConfig {
  const raw = (api.pluginConfig ?? {}) as Partial<ReflectionPluginConfig>;
  const botId = _resolveBotId();
  return {
    reflectionDir: resolvePath(raw.reflectionDir ?? `~/.openclaw/USER/${botId}/reflections`),
    memoryDir: resolvePath(raw.memoryDir ?? "~/.openclaw/workspace/memory"),
    boardDbPath: resolvePath(raw.boardDbPath ?? `~/.openclaw/USER/${botId}/brain`),
    kbDbPath: resolvePath(raw.kbDbPath ?? `~/.openclaw/USER/${botId}/kb`),
    transcriptsDir: resolvePath(raw.transcriptsDir ?? "~/.claude/projects"),
  };
}

export default function register(api: OpenClawPluginApi): void {
  const cfg = resolveConfig(api);
  api.logger.info(`mc-reflection loading (reflectionDir=${cfg.reflectionDir})`);

  const gatherConfig: GatherConfig = {
    memoryDir: cfg.memoryDir,
    boardDbPath: cfg.boardDbPath,
    kbDbPath: cfg.kbDbPath,
    transcriptsDir: cfg.transcriptsDir,
  };

  const toolsConfig: ReflectionToolsConfig = {
    reflectionDir: cfg.reflectionDir,
    gatherConfig,
  };

  api.registerCli((ctx) => {
    registerReflectionCommands(
      { program: ctx.program, logger: api.logger },
      cfg.reflectionDir,
      gatherConfig,
    );
  });

  for (const tool of createReflectionTools(toolsConfig, api.logger)) {
    api.registerTool(tool);
  }

  api.logger.info("mc-reflection loaded");
}
