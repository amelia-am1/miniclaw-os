import { execSync } from "node:child_process";

export function vaultGet(vaultBin: string, key: string): string | null {
  try {
    const out = execSync(`${vaultBin} get ${key}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    // vault may return "key = value" format
    if (out.includes(" = ")) {
      return out.split(" = ").slice(1).join(" = ").trim() || null;
    }
    return out || null;
  } catch {
    return null;
  }
}

export function vaultSet(vaultBin: string, key: string, value: string): void {
  execSync(`${vaultBin} set ${key} ${JSON.stringify(value)}`, { stdio: "inherit" });
}

const EMAIL_PASSWORD_KEY = "email-app-password";
const LEGACY_KEY = "gmail-app-password";

export function getAppPassword(vaultBin: string): string | null {
  // Try canonical key first, fall back to legacy gmail-app-password for existing installs
  return vaultGet(vaultBin, EMAIL_PASSWORD_KEY) ?? vaultGet(vaultBin, LEGACY_KEY);
}

export function saveAppPassword(vaultBin: string, password: string): void {
  vaultSet(vaultBin, EMAIL_PASSWORD_KEY, password);
}

const LEGACY_EMAIL_KEY = "gmail-email";
const EMAIL_ADDRESS_KEY = "email-address";

interface MigrationResult {
  migrated: string[];
  skipped: string[];
}

/**
 * Migrate legacy gmail-* vault keys to email-* names.
 * Idempotent: skips keys that don't exist or are already migrated.
 */
export function migrateLegacyKeys(vaultBin: string): MigrationResult {
  const result: MigrationResult = { migrated: [], skipped: [] };

  const keyMap: [string, string][] = [
    [LEGACY_KEY, EMAIL_PASSWORD_KEY],
    [LEGACY_EMAIL_KEY, EMAIL_ADDRESS_KEY],
  ];

  for (const [oldKey, newKey] of keyMap) {
    const oldValue = vaultGet(vaultBin, oldKey);
    if (!oldValue) {
      result.skipped.push(oldKey);
      continue;
    }
    vaultSet(vaultBin, newKey, oldValue);
    vaultDelete(vaultBin, oldKey);
    result.migrated.push(`${oldKey} → ${newKey}`);
  }

  return result;
}

export function vaultDelete(vaultBin: string, key: string): void {
  try {
    execSync(`${vaultBin} rm ${key}`, { stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    // Key may not exist — ignore
  }
}
