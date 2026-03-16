import { execSync } from "node:child_process";

export function vaultGet(vaultBin: string, key: string): string | null {
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

export function vaultSet(vaultBin: string, key: string, value: string): void {
  execSync(`${vaultBin} set ${key} ${JSON.stringify(value)}`, { stdio: "inherit" });
}

export function getTursoUrl(vaultBin: string): string | null {
  return vaultGet(vaultBin, "turso-booking-url");
}

export function getTursoToken(vaultBin: string): string | null {
  return vaultGet(vaultBin, "turso-booking-token");
}

export function saveTursoUrl(vaultBin: string, url: string): void {
  vaultSet(vaultBin, "turso-booking-url", url);
}

export function saveTursoToken(vaultBin: string, token: string): void {
  vaultSet(vaultBin, "turso-booking-token", token);
}
