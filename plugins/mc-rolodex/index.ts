/**
 * mc-rolodex — Contact browser plugin for MiniClaw
 *
 * Fast, searchable access to trusted contacts.
 * Search by name, email, phone, domain, or tag.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';

function _resolveBotId(): string {
  if (process.env.OPENCLAW_BOT_ID) return process.env.OPENCLAW_BOT_ID;
  const stateDir = process.env.OPENCLAW_STATE_DIR ?? path.join(os.homedir(), '.openclaw');
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(stateDir, 'openclaw.json'), 'utf-8'));
    if (cfg.botId) return cfg.botId as string;
  } catch {}
  throw new Error('OPENCLAW_BOT_ID not set and botId not found in openclaw.json — run the setup wizard');
}
import { SearchEngine } from './src/search/engine.js';
import { registerRolodexCommands } from './src/cli/commands.js';

export * from './src/search/types.js';
export * from './src/search/engine.js';
export * from './src/tui/browser.js';

export { SearchEngine } from './src/search/engine.js';
export { ContactBrowser } from './src/tui/browser.js';

// ---- Config ----

interface RolodexConfig {
  storagePath: string;
}

function resolvePath(p: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function resolveConfig(api: OpenClawPluginApi): RolodexConfig {
  const raw = (api.pluginConfig ?? {}) as Partial<RolodexConfig>;
  return {
    storagePath: resolvePath(
      raw.storagePath ?? `~/.openclaw/USER/${_resolveBotId()}/rolodex/contacts.json`,
    ),
  };
}

// ---- Plugin entry point ----

export default function register(api: OpenClawPluginApi): void {
  const cfg = resolveConfig(api);
  api.logger.info(`mc-rolodex loading (storagePath=${cfg.storagePath})`);

  const engine = new SearchEngine(cfg.storagePath);

  api.logger.info(`mc-rolodex loaded (${engine.getAll().length} contacts)`);

  // ---- CLI ----
  api.registerCli((ctx) => {
    registerRolodexCommands(
      { program: ctx.program, logger: api.logger },
      engine,
    );
  });
}
