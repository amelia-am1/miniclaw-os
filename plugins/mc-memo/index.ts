/**
 * mc-memo — OpenClaw plugin
 *
 * Short-term working memory for agent runs.
 * Per-card scratchpad: append timestamped notes to flat markdown files.
 * Prevents agents from repeating failed approaches within a card run.
 *
 * Memo dir: ~/.openclaw/USER/<bot_id>/memos/<card_id>.md
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
import { registerMemoCommands } from "./cli/commands.js";
import { createMemoTools } from "./tools/definitions.js";

interface MemoConfig {
  memoDir: string;
}

function resolvePath(p: string): string {
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function resolveConfig(api: OpenClawPluginApi): MemoConfig {
  const raw = (api.pluginConfig ?? {}) as Partial<MemoConfig>;
  return {
    memoDir: resolvePath(raw.memoDir ?? `~/.openclaw/USER/${_resolveBotId()}/memos`),
  };
}

export default function register(api: OpenClawPluginApi): void {
  const cfg = resolveConfig(api);
  api.logger.info(`mc-memo loading (memoDir=${cfg.memoDir})`);

  api.registerCli((ctx) => {
    registerMemoCommands({ program: ctx.program, logger: api.logger }, cfg.memoDir);
  });

  for (const tool of createMemoTools(cfg.memoDir, api.logger)) {
    api.registerTool(tool);
  }

  api.logger.info("mc-memo loaded");
}
