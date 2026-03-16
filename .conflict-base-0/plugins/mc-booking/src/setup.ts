import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { BookingConfig } from "./config.js";
import { getTursoUrl, saveTursoUrl, saveTursoToken } from "./vault.js";
import { getDb } from "./db.js";

export async function runSetup(cfg: BookingConfig): Promise<void> {
  const existingUrl = getTursoUrl(cfg.vaultBin);
  if (existingUrl) {
    console.log(`Turso URL found in vault (${existingUrl.substring(0, 30)}...).`);
    console.log("Verifying connection...");
    try {
      const db = await getDb(cfg);
      await db.execute("SELECT 1");
      console.log("Connection OK. Booking database is ready.");
      return;
    } catch (e: unknown) {
      console.error(`Connection failed: ${(e as Error).message}`);
      console.log("Your credentials may be invalid. Re-run setup to replace them.");
    }
  }

  const rl = readline.createInterface({ input, output });
  console.log();
  console.log("=== Booking Database Setup (Turso) ===");
  console.log();
  console.log("Option A: Automated (if turso CLI is installed)");
  console.log("  1. Install: brew install tursodatabase/tap/turso");
  console.log("  2. Sign up: turso auth signup");
  console.log("  3. Create DB: turso db create miniclaw-booking");
  console.log("  4. Get URL: turso db show miniclaw-booking --url");
  console.log("  5. Get token: turso db tokens create miniclaw-booking");
  console.log();
  console.log("Option B: Manual (web dashboard)");
  console.log("  1. Go to https://turso.tech and sign up");
  console.log("  2. Create a database named 'miniclaw-booking'");
  console.log("  3. Copy the database URL and auth token");
  console.log();

  const url = await rl.question("Paste your Turso database URL (libsql://...): ");
  if (!url.trim()) {
    console.error("No URL entered, aborted.");
    rl.close();
    process.exit(1);
  }

  const token = await rl.question("Paste your Turso auth token: ");
  rl.close();

  if (!token.trim()) {
    console.error("No token entered, aborted.");
    process.exit(1);
  }

  saveTursoUrl(cfg.vaultBin, url.trim());
  saveTursoToken(cfg.vaultBin, token.trim());
  console.log("Credentials saved to vault.");

  console.log("Verifying connection and running migrations...");
  try {
    const db = await getDb(cfg);
    await db.execute("SELECT 1");
    console.log("Connection OK. Schema created. Booking database is ready.");
  } catch (e: unknown) {
    console.error(`Connection failed: ${(e as Error).message}`);
    console.error("Credentials were saved but may be invalid.");
    process.exit(1);
  }
}
