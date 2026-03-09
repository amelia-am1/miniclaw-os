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

export function getAppPassword(vaultBin: string): string | null {
  return vaultGet(vaultBin, "gmail-app-password");
}

export function saveAppPassword(vaultBin: string, password: string): void {
  vaultSet(vaultBin, "gmail-app-password", password);
}
