/**
 * store.test.ts — unit tests for AppointmentStore
 *
 * Uses @libsql/client with :memory: for fast in-process testing.
 */

import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppointmentStore } from "./store.js";

let db: Client;
let store: AppointmentStore;

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
CREATE INDEX IF NOT EXISTS idx_appointments_time_status ON appointments(scheduled_time, status);
CREATE INDEX IF NOT EXISTS idx_appointments_token ON appointments(manage_token);
CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(SCHEMA);
  store = new AppointmentStore(db);
});

afterEach(() => {
  db.close();
});

// Future time for tests
const futureTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const futureTime2 = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();

describe("create", () => {
  it("creates an appointment with all fields", async () => {
    const apt = await store.create({
      name: "Alice Smith",
      email: "alice@example.com",
      interest: "AI consulting",
      scheduled_time: futureTime,
      notes: "Looking forward to it",
    });
    expect(apt.id).toMatch(/^apt_[0-9a-f]{8}$/);
    expect(apt.name).toBe("Alice Smith");
    expect(apt.email).toBe("alice@example.com");
    expect(apt.interest).toBe("AI consulting");
    expect(apt.status).toBe("confirmed");
    expect(apt.manage_token).toHaveLength(64); // 32 bytes hex
    expect(apt.created_at).toBeTruthy();
    expect(apt.updated_at).toBeTruthy();
  });

  it("creates appointment with minimal fields", async () => {
    const apt = await store.create({
      name: "Bob",
      email: "bob@example.com",
      scheduled_time: futureTime,
    });
    expect(apt.name).toBe("Bob");
    expect(apt.interest).toBe("");
    expect(apt.notes).toBe("");
    expect(apt.stripe_payment_id).toBe("");
  });

  it("creates appointment with payment ID and sets paid_at", async () => {
    const apt = await store.create({
      name: "Carol",
      email: "carol@example.com",
      scheduled_time: futureTime,
      stripe_payment_id: "pi_test123",
    });
    expect(apt.stripe_payment_id).toBe("pi_test123");
    expect(apt.paid_at).toBeTruthy();
  });

  it("generates unique IDs and tokens", async () => {
    const apt1 = await store.create({ name: "A", email: "a@x.com", scheduled_time: futureTime });
    const apt2 = await store.create({ name: "B", email: "b@x.com", scheduled_time: futureTime2 });
    expect(apt1.id).not.toBe(apt2.id);
    expect(apt1.manage_token).not.toBe(apt2.manage_token);
  });
});

describe("getByToken", () => {
  it("returns appointment by token", async () => {
    const apt = await store.create({ name: "Alice", email: "a@x.com", scheduled_time: futureTime });
    const found = await store.getByToken(apt.manage_token);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(apt.id);
    expect(found!.name).toBe("Alice");
  });

  it("returns null for unknown token", async () => {
    const found = await store.getByToken("nonexistent");
    expect(found).toBeNull();
  });
});

describe("getById", () => {
  it("returns appointment by ID", async () => {
    const apt = await store.create({ name: "Bob", email: "b@x.com", scheduled_time: futureTime });
    const found = await store.getById(apt.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Bob");
  });

  it("returns null for unknown ID", async () => {
    expect(await store.getById("apt_nonexist")).toBeNull();
  });
});

describe("listUpcoming", () => {
  it("returns empty when no appointments", async () => {
    const list = await store.listUpcoming();
    expect(list).toEqual([]);
  });

  it("returns confirmed future appointments sorted by time", async () => {
    await store.create({ name: "Later", email: "a@x.com", scheduled_time: futureTime2 });
    await store.create({ name: "Sooner", email: "b@x.com", scheduled_time: futureTime });
    const list = await store.listUpcoming();
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe("Sooner");
    expect(list[1].name).toBe("Later");
  });

  it("excludes cancelled appointments", async () => {
    const apt = await store.create({ name: "Cancel me", email: "a@x.com", scheduled_time: futureTime });
    await store.cancel(apt.manage_token);
    const list = await store.listUpcoming();
    expect(list).toHaveLength(0);
  });

  it("respects limit", async () => {
    await store.create({ name: "A", email: "a@x.com", scheduled_time: futureTime });
    await store.create({ name: "B", email: "b@x.com", scheduled_time: futureTime2 });
    const list = await store.listUpcoming(1);
    expect(list).toHaveLength(1);
  });
});

describe("hasConflict", () => {
  it("returns false when no appointments at time", async () => {
    expect(await store.hasConflict(futureTime)).toBe(false);
  });

  it("returns true when confirmed appointment exists at time", async () => {
    await store.create({ name: "A", email: "a@x.com", scheduled_time: futureTime });
    expect(await store.hasConflict(futureTime)).toBe(true);
  });

  it("returns false when appointment at time is cancelled", async () => {
    const apt = await store.create({ name: "A", email: "a@x.com", scheduled_time: futureTime });
    await store.cancel(apt.manage_token);
    expect(await store.hasConflict(futureTime)).toBe(false);
  });
});

describe("countOnDate", () => {
  it("returns 0 for empty date", async () => {
    expect(await store.countOnDate("2026-12-25")).toBe(0);
  });

  it("counts confirmed appointments on date", async () => {
    const dateStr = futureTime.split("T")[0];
    await store.create({ name: "A", email: "a@x.com", scheduled_time: futureTime });
    expect(await store.countOnDate(dateStr)).toBe(1);
  });
});

describe("cancel", () => {
  it("cancels a confirmed appointment", async () => {
    const apt = await store.create({ name: "Cancel me", email: "a@x.com", scheduled_time: futureTime });
    const cancelled = await store.cancel(apt.manage_token);
    expect(cancelled).not.toBeNull();
    expect(cancelled!.status).toBe("cancelled");
    expect(cancelled!.cancelled_at).toBeTruthy();
  });

  it("records refund info", async () => {
    const apt = await store.create({ name: "A", email: "a@x.com", scheduled_time: futureTime });
    const cancelled = await store.cancel(apt.manage_token, "re_test123", 9950);
    expect(cancelled!.stripe_refund_id).toBe("re_test123");
    expect(cancelled!.refund_amount).toBe(9950);
  });

  it("returns null for unknown token", async () => {
    expect(await store.cancel("nonexistent")).toBeNull();
  });

  it("returns null for already cancelled appointment", async () => {
    const apt = await store.create({ name: "A", email: "a@x.com", scheduled_time: futureTime });
    await store.cancel(apt.manage_token);
    expect(await store.cancel(apt.manage_token)).toBeNull();
  });
});

describe("reschedule", () => {
  it("reschedules to a new time", async () => {
    const apt = await store.create({ name: "A", email: "a@x.com", scheduled_time: futureTime });
    const updated = await store.reschedule(apt.manage_token, futureTime2);
    expect(updated).not.toBeNull();
    expect(updated!.scheduled_time).toBe(futureTime2);
  });

  it("returns null for unknown token", async () => {
    expect(await store.reschedule("nonexistent", futureTime2)).toBeNull();
  });

  it("returns null for cancelled appointment", async () => {
    const apt = await store.create({ name: "A", email: "a@x.com", scheduled_time: futureTime });
    await store.cancel(apt.manage_token);
    expect(await store.reschedule(apt.manage_token, futureTime2)).toBeNull();
  });
});

describe("config", () => {
  it("returns null for unset key", async () => {
    expect(await store.getConfig("unset-key")).toBeNull();
  });

  it("round-trips a config value", async () => {
    await store.setConfig("priceCents", "29900");
    expect(await store.getConfig("priceCents")).toBe("29900");
  });

  it("overwrites existing config", async () => {
    await store.setConfig("maxPerDay", "1");
    await store.setConfig("maxPerDay", "3");
    expect(await store.getConfig("maxPerDay")).toBe("3");
  });
});
