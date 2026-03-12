import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

/**
 * Resolve the bot ID from OPENCLAW_BOT_ID env var, falling back to
 * the botId field in openclaw.json.
 */
export function resolveBotId(): string {
  if (process.env.OPENCLAW_BOT_ID) return process.env.OPENCLAW_BOT_ID;

  const stateDir = process.env.OPENCLAW_STATE_DIR ?? path.join(os.homedir(), ".openclaw");
  const configPath = path.join(stateDir, "openclaw.json");
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (cfg.botId) return cfg.botId;
  } catch { /* missing or corrupt config */ }

  throw new Error(
    "Cannot resolve bot ID: set OPENCLAW_BOT_ID or run the setup wizard to set botId in openclaw.json",
  );
}

/**
 * Resolve the USER/<botId> base directory.
 */
export function resolveUserDir(): string {
  const stateDir = process.env.OPENCLAW_STATE_DIR ?? path.join(os.homedir(), ".openclaw");
  return path.join(stateDir, "USER", resolveBotId());
}
