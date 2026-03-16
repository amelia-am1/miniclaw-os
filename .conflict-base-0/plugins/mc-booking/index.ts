import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveConfig } from "./src/config.js";
import { getTursoUrl } from "./src/vault.js";
import { registerBookingCommands } from "./cli/commands.js";
import { createBookingTools } from "./tools/definitions.js";

export default function register(api: OpenClawPluginApi): void {
  const cfg = resolveConfig((api.pluginConfig ?? {}) as Record<string, unknown>);

  const hasDb = !!getTursoUrl(cfg.vaultBin);
  if (hasDb) {
    api.logger.info(`mc-booking loaded (provider=${cfg.paymentProvider}, port=${cfg.port}, auth=ok)`);
  } else {
    api.logger.warn("mc-booking loaded — no Turso credentials yet. Run: mc mc-booking setup");
  }

  api.registerCli((ctx) => {
    registerBookingCommands({ program: ctx.program, cfg, logger: api.logger });
  });

  for (const tool of createBookingTools(cfg)) {
    api.registerTool(tool);
  }
}
