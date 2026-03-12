import type { Command } from "commander";
import type { Logger } from "openclaw/plugin-sdk";
import type { BookingConfig } from "../src/config.js";
import { getDb } from "../src/db.js";
import { AppointmentStore } from "../src/store.js";
import { generateSlots } from "../src/slots.js";
import { runSetup } from "../src/setup.js";
import { startServer } from "../src/server.js";

interface Ctx {
  program: Command;
  cfg: BookingConfig;
  logger: Logger;
}

export function registerBookingCommands(ctx: Ctx): void {
  const { program, cfg } = ctx;

  const sub = program
    .command("mc-booking")
    .description("Appointment scheduling — slots, bookings, payments, HTTP server");

  // ---- setup ----
  sub
    .command("setup")
    .description("Set up Turso database for booking storage")
    .action(async () => {
      await runSetup(cfg);
    });

  // ---- slots ----
  sub
    .command("slots")
    .description("List available booking slots")
    .action(async () => {
      const db = await getDb(cfg);
      const store = new AppointmentStore(db);
      const slots = await generateSlots(cfg, store);
      const available = slots.filter((s) => s.available);

      if (!available.length) {
        console.log("No available slots in the booking window.");
        return;
      }

      console.log(`Available slots (next ${cfg.windowWeeks} weeks):`);
      let lastDate = "";
      for (const s of available) {
        const d = new Date(s.time);
        const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        if (dateStr !== lastDate) {
          console.log();
          console.log(`  ${dateStr}`);
          lastDate = dateStr;
        }
        console.log(`    ${timeStr}  (${s.time})`);
      }
    });

  // ---- list ----
  sub
    .command("list")
    .description("List upcoming confirmed appointments")
    .option("-n, --limit <n>", "Max appointments", "20")
    .action(async (opts: { limit: string }) => {
      const db = await getDb(cfg);
      const store = new AppointmentStore(db);
      const apts = await store.listUpcoming(parseInt(opts.limit, 10));

      if (!apts.length) {
        console.log("No upcoming appointments.");
        return;
      }

      for (const a of apts) {
        const d = new Date(a.scheduled_time);
        const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        console.log(`[${a.id}] ${dateStr} ${timeStr}`);
        console.log(`  Name:    ${a.name}`);
        console.log(`  Email:   ${a.email}`);
        if (a.interest) console.log(`  Interest: ${a.interest}`);
        console.log(`  Token:   ${a.manage_token.substring(0, 8)}...`);
        console.log();
      }
    });

  // ---- show ----
  sub
    .command("show <token>")
    .description("Show appointment details by manage token")
    .action(async (token: string) => {
      const db = await getDb(cfg);
      const store = new AppointmentStore(db);
      const apt = await store.getByToken(token);

      if (!apt) {
        console.error("Appointment not found.");
        process.exit(1);
      }

      const d = new Date(apt.scheduled_time);
      console.log(`Appointment: ${apt.id}`);
      console.log(`  Name:       ${apt.name}`);
      console.log(`  Email:      ${apt.email}`);
      console.log(`  Interest:   ${apt.interest || "(none)"}`);
      console.log(`  Scheduled:  ${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`);
      console.log(`  Status:     ${apt.status}`);
      console.log(`  Notes:      ${apt.notes || "(none)"}`);
      console.log(`  Token:      ${apt.manage_token}`);
      if (apt.stripe_payment_id) console.log(`  Payment ID: ${apt.stripe_payment_id}`);
      if (apt.paid_at) console.log(`  Paid at:    ${apt.paid_at}`);
      if (apt.cancelled_at) console.log(`  Cancelled:  ${apt.cancelled_at}`);
      console.log(`  Created:    ${apt.created_at}`);
    });

  // ---- cancel ----
  sub
    .command("cancel <token>")
    .description("Cancel an appointment (with refund)")
    .action(async (token: string) => {
      const db = await getDb(cfg);
      const store = new AppointmentStore(db);
      const apt = await store.getByToken(token);

      if (!apt) {
        console.error("Appointment not found.");
        process.exit(1);
      }
      if (apt.status !== "confirmed") {
        console.error(`Appointment is already ${apt.status}.`);
        process.exit(1);
      }

      const { calculateRefundAmount, refundViaProvider } = await import("../src/stripe-bridge.js");
      let refundId = "";
      let refundAmount = 0;

      if (apt.stripe_payment_id && apt.stripe_payment_id !== "free") {
        refundAmount = calculateRefundAmount(apt.scheduled_time, cfg.priceCents);
        const hoursUntil = (new Date(apt.scheduled_time).getTime() - Date.now()) / (1000 * 60 * 60);
        const pct = hoursUntil >= 48 ? "100%" : "50%";
        console.log(`Refunding ${pct} ($${(refundAmount / 100).toFixed(2)})...`);

        const refund = refundViaProvider(cfg, apt.stripe_payment_id, refundAmount);
        if (!refund.success) {
          console.error(`Refund failed: ${refund.error}`);
          process.exit(1);
        }
        refundId = refund.refundId || "";
      }

      await store.cancel(token, refundId, refundAmount);
      console.log(`Appointment ${apt.id} cancelled.`);
      if (refundAmount > 0) {
        console.log(`Refund: $${(refundAmount / 100).toFixed(2)} (${refundId})`);
      }
    });

  // ---- config ----
  sub
    .command("config")
    .description("View or set booking configuration")
    .argument("[key]", "Config key to set")
    .argument("[value]", "Config value")
    .action(async (key?: string, value?: string) => {
      if (!key) {
        console.log("Booking configuration:");
        console.log(`  paymentProvider: ${cfg.paymentProvider}`);
        console.log(`  port:           ${cfg.port}`);
        console.log(`  availableDays:  ${cfg.availableDays.join(", ")} (1=Mon, 7=Sun)`);
        console.log(`  timeSlots:      ${cfg.timeSlots.join(", ")} (UTC hours)`);
        console.log(`  durationMinutes: ${cfg.durationMinutes}`);
        console.log(`  priceCents:     ${cfg.priceCents} ($${(cfg.priceCents / 100).toFixed(2)})`);
        console.log(`  maxPerDay:      ${cfg.maxPerDay}`);
        console.log(`  windowWeeks:    ${cfg.windowWeeks}`);
        console.log(`  origins:        ${cfg.origins.join(", ")}`);

        const db = await getDb(cfg);
        const store = new AppointmentStore(db);
        const dbOverrides = ["availableDays", "timeSlots", "durationMinutes", "priceCents", "maxPerDay", "windowWeeks"];
        console.log();
        console.log("DB overrides:");
        for (const k of dbOverrides) {
          const v = await store.getConfig(k);
          if (v) console.log(`  ${k}: ${v}`);
        }
        return;
      }

      if (!value) {
        const db = await getDb(cfg);
        const store = new AppointmentStore(db);
        const v = await store.getConfig(key);
        console.log(v ? `${key} = ${v}` : `${key} not set in DB (using default from plugin config)`);
        return;
      }

      const db = await getDb(cfg);
      const store = new AppointmentStore(db);
      await store.setConfig(key, value);
      console.log(`Set ${key} = ${value}`);
    });

  // ---- serve ----
  sub
    .command("serve")
    .description("Start the booking HTTP server")
    .action(async () => {
      await startServer(cfg);
    });
}
