import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import type { BookingConfig } from "./config.js";
import { getDb } from "./db.js";
import { AppointmentStore } from "./store.js";
import { generateSlots } from "./slots.js";
import { chargeViaProvider, refundViaProvider, calculateRefundAmount } from "./stripe-bridge.js";
import { WIDGET_HTML } from "../web/embed.js";

export async function startServer(cfg: BookingConfig): Promise<void> {
  const db = await getDb(cfg);
  const store = new AppointmentStore(db);
  const app = new Hono();

  app.use("/*", cors({ origin: cfg.origins }));

  // ---- Health ----
  app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

  // ---- Config ----
  app.get("/api/config", (c) =>
    c.json({
      priceCents: cfg.priceCents,
      durationMinutes: cfg.durationMinutes,
      availableDays: cfg.availableDays,
      timeSlots: cfg.timeSlots,
      windowWeeks: cfg.windowWeeks,
      currency: "usd",
    }),
  );

  // ---- Slots ----
  app.get("/api/slots", async (c) => {
    const slots = await generateSlots(cfg, store);
    return c.json({ slots });
  });

  // ---- Create appointment ----
  app.post("/api/appointments", async (c) => {
    const body = await c.req.json();
    const { name, email, interest, scheduled_time, notes } = body;

    if (!name || !email || !scheduled_time) {
      return c.json({ error: "name, email, and scheduled_time are required" }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: "Invalid email address" }, 400);
    }

    const slotDate = new Date(scheduled_time);
    if (isNaN(slotDate.getTime())) {
      return c.json({ error: "Invalid scheduled_time (must be ISO 8601)" }, 400);
    }

    if (slotDate <= new Date()) {
      return c.json({ error: "Cannot book in the past" }, 400);
    }

    const hasConflict = await store.hasConflict(scheduled_time);
    if (hasConflict) {
      return c.json({ error: "That time slot is already booked" }, 409);
    }

    const dateStr = scheduled_time.split("T")[0];
    const dayCount = await store.countOnDate(dateStr);
    if (dayCount >= cfg.maxPerDay) {
      return c.json({ error: "No more slots available for that day" }, 409);
    }

    let paymentId = "";
    if (cfg.paymentProvider !== "none") {
      const charge = chargeViaProvider(cfg, cfg.priceCents, "usd", `Booking: ${name} — ${interest || "consultation"}`);
      if (!charge.success) {
        return c.json({ error: `Payment failed: ${charge.error}` }, 502);
      }
      paymentId = charge.paymentId || "";
    }

    const apt = await store.create({
      name,
      email,
      interest: interest || "",
      scheduled_time,
      notes: notes || "",
      stripe_payment_id: paymentId,
    });

    return c.json({
      id: apt.id,
      manage_token: apt.manage_token,
      scheduled_time: apt.scheduled_time,
      status: apt.status,
    }, 201);
  });

  // ---- Get appointment by token ----
  app.get("/api/appointments/:token", async (c) => {
    const token = c.req.param("token");
    const apt = await store.getByToken(token);
    if (!apt) return c.json({ error: "Appointment not found" }, 404);
    return c.json({
      id: apt.id,
      name: apt.name,
      email: apt.email,
      interest: apt.interest,
      scheduled_time: apt.scheduled_time,
      notes: apt.notes,
      status: apt.status,
      paid_at: apt.paid_at,
      created_at: apt.created_at,
    });
  });

  // ---- Reschedule ----
  app.post("/api/appointments/:token/reschedule", async (c) => {
    const token = c.req.param("token");
    const body = await c.req.json();
    const { new_time } = body;

    if (!new_time) return c.json({ error: "new_time is required" }, 400);

    const apt = await store.getByToken(token);
    if (!apt) return c.json({ error: "Appointment not found" }, 404);
    if (apt.status !== "confirmed") return c.json({ error: "Only confirmed appointments can be rescheduled" }, 400);

    const scheduled = new Date(apt.scheduled_time);
    const hoursUntil = (scheduled.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < 48) {
      return c.json({ error: "Rescheduling requires at least 48 hours notice" }, 400);
    }

    const hasConflict = await store.hasConflict(new_time);
    if (hasConflict) return c.json({ error: "That time slot is already booked" }, 409);

    const updated = await store.reschedule(token, new_time);
    return c.json({
      id: updated!.id,
      scheduled_time: updated!.scheduled_time,
      status: updated!.status,
    });
  });

  // ---- Cancel ----
  app.post("/api/appointments/:token/cancel", async (c) => {
    const token = c.req.param("token");
    const apt = await store.getByToken(token);
    if (!apt) return c.json({ error: "Appointment not found" }, 404);
    if (apt.status !== "confirmed") return c.json({ error: "Only confirmed appointments can be cancelled" }, 400);

    let refundId = "";
    let refundAmount = 0;

    if (apt.stripe_payment_id && apt.stripe_payment_id !== "free") {
      refundAmount = calculateRefundAmount(apt.scheduled_time, cfg.priceCents);
      const refund = refundViaProvider(cfg, apt.stripe_payment_id, refundAmount);
      if (!refund.success) {
        return c.json({ error: `Refund failed: ${refund.error}` }, 502);
      }
      refundId = refund.refundId || "";
      refundAmount = refund.amount || refundAmount;
    }

    const cancelled = await store.cancel(token, refundId, refundAmount);
    return c.json({
      id: cancelled!.id,
      status: "cancelled",
      refund_amount: refundAmount,
      refund_percent: refundAmount === cfg.priceCents ? 100 : 50,
    });
  });

  // ---- Widget ----
  app.get("/widget", (c) => {
    return c.html(WIDGET_HTML);
  });

  console.log(`mc-booking server starting on port ${cfg.port}...`);
  serve({ fetch: app.fetch, port: cfg.port });
  console.log(`mc-booking server running at http://localhost:${cfg.port}`);
  console.log(`  API:    http://localhost:${cfg.port}/api/slots`);
  console.log(`  Widget: http://localhost:${cfg.port}/widget`);
  console.log(`  Health: http://localhost:${cfg.port}/health`);
}
