import type { AnyAgentTool } from "openclaw/plugin-sdk";
import type { BookingConfig } from "../src/config.js";
import { getDb } from "../src/db.js";
import { AppointmentStore } from "../src/store.js";
import { generateSlots } from "../src/slots.js";

function schema(props: Record<string, unknown>, required?: string[]): unknown {
  return {
    type: "object",
    properties: props,
    required: required ?? [],
    additionalProperties: false,
  };
}

function str(description: string): unknown {
  return { type: "string", description };
}

function optStr(description: string): unknown {
  return { type: "string", description };
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text: text.trim() }], details: {} };
}

function err(text: string) {
  return {
    content: [{ type: "text" as const, text: text.trim() }],
    isError: true,
    details: {},
  };
}

export function createBookingTools(cfg: BookingConfig): AnyAgentTool[] {
  return [
    {
      name: "booking_slots",
      label: "Booking Slots",
      description: "List available booking slots for the configured window.",
      parameters: schema({}) as never,
      execute: async () => {
        try {
          const db = await getDb(cfg);
          const store = new AppointmentStore(db);
          const slots = await generateSlots(cfg, store);
          const available = slots.filter((s) => s.available);
          if (!available.length) return ok("No available slots.");
          const lines = available.map((s) => {
            const d = new Date(s.time);
            return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} (${s.time})`;
          });
          return ok(lines.join("\n"));
        } catch (e: unknown) {
          return err(`Failed to get slots: ${(e as Error).message}`);
        }
      },
    },

    {
      name: "booking_list",
      label: "Booking List",
      description: "List upcoming confirmed appointments.",
      parameters: schema({
        limit: optStr("Max number of appointments (default: 20)"),
      }) as never,
      execute: async (_id: unknown, params: Record<string, unknown>) => {
        try {
          const db = await getDb(cfg);
          const store = new AppointmentStore(db);
          const limit = params.limit ? parseInt(params.limit as string, 10) : 20;
          const apts = await store.listUpcoming(limit);
          if (!apts.length) return ok("No upcoming appointments.");
          const lines = apts.map((a) => {
            const d = new Date(a.scheduled_time);
            return `[${a.id}] ${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} — ${a.name} (${a.email})`;
          });
          return ok(lines.join("\n"));
        } catch (e: unknown) {
          return err(`Failed to list appointments: ${(e as Error).message}`);
        }
      },
    },

    {
      name: "booking_show",
      label: "Booking Show",
      description: "Show appointment details by manage token.",
      parameters: schema(
        { token: str("Appointment manage token") },
        ["token"],
      ) as never,
      execute: async (_id: unknown, params: Record<string, unknown>) => {
        try {
          const db = await getDb(cfg);
          const store = new AppointmentStore(db);
          const apt = await store.getByToken(params.token as string);
          if (!apt) return err("Appointment not found.");
          const d = new Date(apt.scheduled_time);
          return ok(
            `Appointment: ${apt.id}\n` +
            `Name: ${apt.name}\n` +
            `Email: ${apt.email}\n` +
            `Interest: ${apt.interest || "(none)"}\n` +
            `Scheduled: ${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}\n` +
            `Status: ${apt.status}\n` +
            `Notes: ${apt.notes || "(none)"}`,
          );
        } catch (e: unknown) {
          return err(`Failed to show appointment: ${(e as Error).message}`);
        }
      },
    },

    {
      name: "booking_cancel",
      label: "Booking Cancel",
      description:
        "Cancel an appointment by manage token. Refund is automatic: 100% if 48h+ before, 50% if less.",
      parameters: schema(
        { token: str("Appointment manage token") },
        ["token"],
      ) as never,
      execute: async (_id: unknown, params: Record<string, unknown>) => {
        try {
          const db = await getDb(cfg);
          const store = new AppointmentStore(db);
          const apt = await store.getByToken(params.token as string);
          if (!apt) return err("Appointment not found.");
          if (apt.status !== "confirmed") return err(`Appointment is already ${apt.status}.`);

          const { calculateRefundAmount, refundViaProvider } = await import("../src/stripe-bridge.js");
          let refundId = "";
          let refundAmount = 0;

          if (apt.stripe_payment_id && apt.stripe_payment_id !== "free") {
            refundAmount = calculateRefundAmount(apt.scheduled_time, cfg.priceCents);
            const refund = refundViaProvider(cfg, apt.stripe_payment_id, refundAmount);
            if (!refund.success) return err(`Refund failed: ${refund.error}`);
            refundId = refund.refundId || "";
          }

          await store.cancel(params.token as string, refundId, refundAmount);
          return ok(
            `Appointment ${apt.id} cancelled.\n` +
            (refundAmount > 0 ? `Refund: $${(refundAmount / 100).toFixed(2)}` : "No refund (free booking)."),
          );
        } catch (e: unknown) {
          return err(`Failed to cancel: ${(e as Error).message}`);
        }
      },
    },

    {
      name: "booking_reschedule",
      label: "Booking Reschedule",
      description:
        "Reschedule an appointment to a new time. Requires 48h notice before the original time.",
      parameters: schema(
        {
          token: str("Appointment manage token"),
          new_time: str("New scheduled time in ISO 8601 format"),
        },
        ["token", "new_time"],
      ) as never,
      execute: async (_id: unknown, params: Record<string, unknown>) => {
        try {
          const db = await getDb(cfg);
          const store = new AppointmentStore(db);
          const apt = await store.getByToken(params.token as string);
          if (!apt) return err("Appointment not found.");
          if (apt.status !== "confirmed") return err(`Appointment is already ${apt.status}.`);

          const scheduled = new Date(apt.scheduled_time);
          const hoursUntil = (scheduled.getTime() - Date.now()) / (1000 * 60 * 60);
          if (hoursUntil < 48) return err("Rescheduling requires at least 48 hours notice.");

          const hasConflict = await store.hasConflict(params.new_time as string);
          if (hasConflict) return err("That time slot is already booked.");

          const updated = await store.reschedule(params.token as string, params.new_time as string);
          const d = new Date(updated!.scheduled_time);
          return ok(
            `Appointment ${updated!.id} rescheduled.\n` +
            `New time: ${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
          );
        } catch (e: unknown) {
          return err(`Failed to reschedule: ${(e as Error).message}`);
        }
      },
    },
  ];
}
