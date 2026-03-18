import { execSync } from "node:child_process";
import * as path from "node:path";
import * as os from "node:os";

const STATE_DIR = process.env.OPENCLAW_STATE_DIR ?? path.join(os.homedir(), ".openclaw");
const DEFAULT_VAULT_BIN = path.join(STATE_DIR, "miniclaw", "SYSTEM", "bin", "mc-vault");

export function vaultGet(key: string, vaultBin = DEFAULT_VAULT_BIN): string | null {
  try {
    const out = execSync(`${vaultBin} get ${key}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (out.includes(" = ")) {
      return out.split(" = ").slice(1).join(" = ").trim() || null;
    }
    return out || null;
  } catch {
    return null;
  }
}

export function vaultSet(key: string, value: string, vaultBin = DEFAULT_VAULT_BIN): void {
  execSync(`${vaultBin} set ${key} -`, {
    input: value,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

export function getBearerToken(vaultBin = DEFAULT_VAULT_BIN): string | null {
  return vaultGet("social-x-bearer-token", vaultBin);
}

export function saveBearerToken(token: string, vaultBin = DEFAULT_VAULT_BIN): void {
  vaultSet("social-x-bearer-token", token, vaultBin);
}
