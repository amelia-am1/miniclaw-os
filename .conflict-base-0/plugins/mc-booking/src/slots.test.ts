/**
 * slots.test.ts — unit tests for slot generation
 */

import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateSlots } from "./slots.js";
import { AppointmentStore } from "./store.js";
import type { BookingConfig } from "./config.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
  interest TEXT NOT NULL DEFAULT '', scheduled_time TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'confirmed',
  manage_token TEXT NOT NULL UNIQUE, stripe_payment_id TEXT NOT NULL DEFAULT '',
  stripe_refund_id TEXT NOT NULL DEFAULT '', refund_amount INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT NOT NULL DEFAULT '', cancelled_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

let db: Client;
let store: AppointmentStore;

const baseCfg: BookingConfig = {
  vaultBin: "/fake",
  paymentProvider: "none",
  port: 4221,
  origins: [],
  availableDays: [1, 2, 3, 4, 5, 6, 7], // all days for predictable testing
  timeSlots: [12],
  durationMinutes: 90,
  priceCents: 19900,
  maxPerDay: 2,
  windowWeeks: 1,
};

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(SCHEMA);
  store = new AppointmentStore(db);
});

afterEach(() => {
  db.close();
});

describe("generateSlots", () => {
  it("returns slots within the window", async () => {
    const slots = await generateSlots(baseCfg, store);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.length).toBeLessThanOrEqual(7); // 1 week, 1 slot per day
  });

  it("all slots are in the future", async () => {
    const slots = await generateSlots(baseCfg, store);
    const now = new Date();
    for (const slot of slots) {
      expect(new Date(slot.time).getTime()).toBeGreaterThan(now.getTime());
    }
  });

  it("marks slots as available when no conflicts", async () => {
    const slots = await generateSlots(baseCfg, store);
    const available = slots.filter((s) => s.available);
    expect(available.length).toBeGreaterThan(0);
  });

  it("marks slot unavailable when booked", async () => {
    const slots = await generateSlots(baseCfg, store);
    const firstAvailable = slots.find((s) => s.available)!;
    expect(firstAvailable).toBeDefined();

    await store.create({
      name: "Blocker",
      email: "blocker@x.com",
      scheduled_time: firstAvailable.time,
    });

    const updated = await generateSlots(baseCfg, store);
    const same = updated.find((s) => s.time === firstAvailable.time);
    expect(same).toBeDefined();
    expect(same!.available).toBe(false);
  });

  it("returns empty for zero-day window", async () => {
    const cfg = { ...baseCfg, windowWeeks: 0 };
    const slots = await generateSlots(cfg, store);
    expect(slots).toEqual([]);
  });

  it("respects availableDays filter", async () => {
    // Only Monday (1)
    const cfg = { ...baseCfg, availableDays: [1], windowWeeks: 4 };
    const slots = await generateSlots(cfg, store);
    for (const slot of slots) {
      const d = new Date(slot.time);
      const dow = d.getUTCDay();
      expect(dow).toBe(1); // Monday
    }
  });

  it("generates multiple time slots per day", async () => {
    const cfg = { ...baseCfg, timeSlots: [10, 14, 18] };
    const slots = await generateSlots(cfg, store);
    expect(slots.length).toBeGreaterThan(7); // more than 1 per day
  });

  it("respects maxPerDay capacity", async () => {
    const cfg = { ...baseCfg, maxPerDay: 1, timeSlots: [10, 14] };
    const slots = await generateSlots(cfg, store);
    const firstDay = slots[0];
    if (!firstDay) return;

    // Book the first slot
    await store.create({
      name: "First",
      email: "a@x.com",
      scheduled_time: firstDay.time,
    });

    const updated = await generateSlots(cfg, store);
    // All slots on the same date should be unavailable
    const dateStr = firstDay.time.split("T")[0];
    const sameDaySlots = updated.filter((s) => s.time.startsWith(dateStr));
    for (const s of sameDaySlots) {
      expect(s.available).toBe(false);
    }
  });
});
