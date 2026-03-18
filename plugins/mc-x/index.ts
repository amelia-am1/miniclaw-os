import * as path from "node:path";
import * as os from "node:os";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { getBearerToken } from "./src/vault.js";
import { registerXCommands } from "./cli/commands.js";
import { createXTools } from "./tools/definitions.js";

const STATE_DIR = process.env.OPENCLAW_STATE_DIR ?? path.join(os.homedir(), ".openclaw");

export default function register(api: OpenClawPluginApi): void {
  const vaultBin = path.join(STATE_DIR, "miniclaw", "SYSTEM", "bin", "mc-vault");
  const hasToken = !!getBearerToken(vaultBin);

  if (hasToken) {
    api.logger.info("mc-x loaded — bearer token found in vault");
  } else {
    api.logger.warn("mc-x: no bearer token in vault. Run: mc mc-x auth --token '<bearer>'");
  }

  api.registerCli((ctx) => {
    registerXCommands({ program: ctx.program, vaultBin, logger: api.logger });
  });

  for (const tool of createXTools(api.logger)) {
    api.registerTool(tool);
  }
}
