/**
 * definitions.test.ts — tool schema validation for mc-booking
 */

import { describe, expect, it, vi } from "vitest";

// Mock DB so tools don't need real Turso
vi.mock("../src/db.js", () => ({
  getDb: () => Promise.reject(new Error("DB should not be called in schema tests")),
}));

import { createBookingTools } from "./definitions.js";
import type { BookingConfig } from "../src/config.js";

const mockCfg: BookingConfig = {
  vaultBin: "/fake/vault",
  paymentProvider: "none",
  port: 4221,
  origins: [],
  availableDays: [1, 2, 3],
  timeSlots: [17, 18, 19],
  durationMinutes: 90,
  priceCents: 19900,
  maxPerDay: 1,
  windowWeeks: 4,
};

const tools = createBookingTools(mockCfg);

describe("createBookingTools", () => {
  it("returns 5 tools", () => {
    expect(tools).toHaveLength(5);
  });

  it("all tools have required fields", () => {
    for (const tool of tools) {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("label");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("parameters");
      expect(tool).toHaveProperty("execute");
      expect(typeof tool.execute).toBe("function");
    }
  });

  it("no duplicate tool names", () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("all start with booking_", () => {
    for (const tool of tools) {
      expect(tool.name).toMatch(/^booking_/);
    }
  });
});

describe("booking_slots tool", () => {
  const tool = tools.find((t) => t.name === "booking_slots")!;

  it("exists with no required params", () => {
    expect(tool).toBeDefined();
    const params = tool.parameters as { required: string[] };
    expect(params.required).toEqual([]);
  });
});

describe("booking_list tool", () => {
  const tool = tools.find((t) => t.name === "booking_list")!;

  it("has optional limit", () => {
    const params = tool.parameters as { properties: Record<string, unknown> };
    expect(params.properties).toHaveProperty("limit");
  });
});

describe("booking_show tool", () => {
  const tool = tools.find((t) => t.name === "booking_show")!;

  it("requires token", () => {
    const params = tool.parameters as { required: string[] };
    expect(params.required).toContain("token");
  });
});

describe("booking_cancel tool", () => {
  const tool = tools.find((t) => t.name === "booking_cancel")!;

  it("requires token", () => {
    const params = tool.parameters as { required: string[] };
    expect(params.required).toContain("token");
  });
});

describe("booking_reschedule tool", () => {
  const tool = tools.find((t) => t.name === "booking_reschedule")!;

  it("requires token and new_time", () => {
    const params = tool.parameters as { required: string[] };
    expect(params.required).toContain("token");
    expect(params.required).toContain("new_time");
  });
});
