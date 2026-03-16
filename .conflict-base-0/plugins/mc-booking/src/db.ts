import { createClient, type Client } from "@libsql/client";
import type { BookingConfig } from "./config.js";
import { getTursoUrl, getTursoToken } from "./vault.js";

let _client: Client | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS appointments (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  interest         TEXT NOT NULL DEFAULT '',
  scheduled_time   TEXT NOT NULL,
  notes            TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'confirmed',
  manage_token     TEXT NOT NULL UNIQUE,
  stripe_payment_id TEXT NOT NULL DEFAULT '',
  stripe_refund_id  TEXT NOT NULL DEFAULT '',
  refund_amount    INTEGER NOT NULL DEFAULT 0,
  paid_at          TEXT NOT NULL DEFAULT '',
  cancelled_at     TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_appointments_time_status
  ON appointments(scheduled_time, status);

CREATE INDEX IF NOT EXISTS idx_appointments_token
  ON appointments(manage_token);

CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export async function getDb(cfg: BookingConfig): Promise<Client> {
  if (_client) return _client;

  const url = getTursoUrl(cfg.vaultBin);
  const token = getTursoToken(cfg.vaultBin);
  if (!url || !token) {
    throw new Error("No turso-booking-url or turso-booking-token in vault. Run: mc mc-booking setup");
  }

  _client = createClient({ url, authToken: token });
  await _client.executeMultiple(SCHEMA);
  return _client;
}

export async function closeDb(): Promise<void> {
  if (_client) {
    _client.close();
    _client = null;
  }
}
